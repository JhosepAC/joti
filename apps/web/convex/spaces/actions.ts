"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { issueClaimGrant, sha256Hex } from "../auth/crypto";
import { CLAIM_SCOPE_ACCOUNT, CLAIM_SCOPE_SPACE } from "../auth/constants";
import { validateEmail } from "../auth/validators";
import { resolveTemplate } from "./templates";
import {
  validateSlug,
  validateSpaceIcon,
  validateSpaceName,
  validateSpacePurpose,
} from "./validators";

// ---------------------------------------------------------------------------
// Spaces actions.
//
// The app still has no session layer (see convex/README.md), so these endpoints
// authorize with the short-lived claim grants from `auth/claimGrants`:
// `account` scope to reach onboarding, `space` scope — bound to one `space_id` —
// to read a workspace.
//
// Each entry point *rotates* the grant it is given: it consumes the caller's
// token and returns a fresh one for whatever comes next. A token captured during
// one step therefore cannot be replayed against a later one, and a token scoped
// to a space cannot be used to finish the profile.
//
// Grant validation and rotation happen inside the spaces mutations (single
// atomic transactions), never as peek-then-consume round trips from here.
// ---------------------------------------------------------------------------

type OnboardingSpace = {
  id: Id<"spaces">;
  slug: string;
  name: string;
  icon: string;
  purpose: string;
};

type OnboardingContext = {
  userId: Id<"auth_users">;
  hasProfile: boolean;
  displayName: string | null;
  spaces: OnboardingSpace[];
};

/** Mints a grant. The raw token is returned once and stored only as a digest. */
async function mintGrant(
  ctx: GenericActionCtx<DataModel>,
  args: {
    email: string;
    user_id: Id<"auth_users">;
    scope: string;
    space_id?: Id<"spaces">;
  },
): Promise<string> {
  const grant = issueClaimGrant();
  await ctx.runMutation(internal.auth.claimGrants.issue, {
    email: args.email,
    user_id: args.user_id,
    scope: args.scope,
    space_id: args.space_id,
    token_hash: sha256Hex(grant),
  });
  return grant;
}

// ---------------------------------------------------------------------------
// getEntryContext -- "where am I, and what may I do next?"
//
// Every successful sign-in and every completed profile lands here, so the
// navigation rule lives in one place instead of being re-derived per screen:
//
//   profile incomplete -> the profile gate
//   profile, no space  -> the first-space onboarding
//   already has one   -> that space's workspace
//
// The `account` grant is consumed on the way in and a fresh one is returned, so
// this endpoint is single-use per sign-in.
// ---------------------------------------------------------------------------

export const getEntryContext: ReturnType<typeof action> = action({
  args: { email: v.string(), claim: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);

    await ctx.runMutation(internal.auth.claimGrants.consume, {
      email: cleanEmail,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: sha256Hex(args.claim),
    });

    const context = (await ctx.runQuery(internal.spaces.queries.getOnboardingContext, {
      email: cleanEmail,
    })) as OnboardingContext;

    if (!context.hasProfile) {
      return {
        stage: "profile" as const,
        displayName: null,
        claim: await mintGrant(ctx, {
          email: cleanEmail,
          user_id: context.userId,
          scope: CLAIM_SCOPE_ACCOUNT,
        }),
        slug: null,
        spaceGrant: null,
      };
    }

    if (context.spaces.length === 0) {
      return {
        stage: "space" as const,
        displayName: context.displayName,
        claim: await mintGrant(ctx, {
          email: cleanEmail,
          user_id: context.userId,
          scope: CLAIM_SCOPE_ACCOUNT,
        }),
        slug: null,
        spaceGrant: null,
      };
    }

    // Returning user: skip onboarding and hand over a grant bound to the space
    // they should land in. The first space is the one onboarding created.
    const first = context.spaces[0] as OnboardingSpace;
    return {
      stage: "workspace" as const,
      displayName: context.displayName,
      claim: null,
      slug: first.slug,
      spaceGrant: await mintGrant(ctx, {
        email: cleanEmail,
        user_id: context.userId,
        scope: CLAIM_SCOPE_SPACE,
        space_id: first.id,
      }),
    };
  },
});

// ---------------------------------------------------------------------------
// createFirstSpace -- the onboarding's terminal step.
//
// The owner is resolved from the grant inside the mutation, never from an
// argument: a caller cannot choose whose space to create. Grant validation,
// the guards, the insert and the burn happen in ONE atomic transaction (see
// spaces/mutations), so concurrent requests cannot double-pass and a
// validation failure leaves the grant live for a retry.
// ---------------------------------------------------------------------------

export const createFirstSpace: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    claim: v.string(),
    name: v.string(),
    icon: v.string(),
    purpose: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    // Validated here for a precise error, and again inside the mutation, which
    // is the check that has to be atomic with the insert.
    const name = validateSpaceName(args.name);
    const icon = validateSpaceIcon(args.icon);
    const purpose = validateSpacePurpose(args.purpose);

    const created = (await ctx.runMutation(internal.spaces.mutations.createFirstSpace, {
      email: cleanEmail,
      token_hash: sha256Hex(args.claim),
      name,
      icon,
      purpose,
    })) as {
      spaceId: Id<"spaces">;
      slug: string;
      name: string;
      icon: string;
      purpose: string;
      owner_id: Id<"auth_users">;
    };

    return {
      slug: created.slug,
      space: {
        slug: created.slug,
        name: created.name,
        icon: created.icon,
        purpose: created.purpose,
        is_private: true,
      },
      // Authorises `/w/<slug>` immediately, so the redirect does not bounce
      // straight back to the sign-in page.
      spaceGrant: await mintGrant(ctx, {
        email: cleanEmail,
        user_id: created.owner_id,
        scope: CLAIM_SCOPE_SPACE,
        space_id: created.spaceId,
      }),
    };
  },
});

// ---------------------------------------------------------------------------
// getWorkspace -- bootstrap for `/w/<slug>`.
//
// The slug is in the URL, which makes it public knowledge, so it authorizes
// nothing on its own: the caller must also present a grant bound to that exact
// `space_id`. A guessed slug therefore renders "not available" rather than
// anybody's space.
//
// Rotates the space grant on every read, so an idle tab loses access after 15
// minutes of inactivity while an active one keeps it.
// ---------------------------------------------------------------------------

export const getWorkspace: ReturnType<typeof action> = action({
  args: { slug: v.string(), grant: v.string() },
  handler: async (ctx, args) => {
    const cleanSlug = validateSlug(args.slug);

    // The successor token is minted up front (it needs Node randomness); the
    // mutation stores it atomically together with the burn of the presented
    // grant, so rotation cannot double-pass under concurrency.
    const nextGrant = issueClaimGrant();

    const loaded = (await ctx.runMutation(internal.spaces.mutations.loadWorkspace, {
      token_hash: sha256Hex(args.grant),
      slug: cleanSlug,
      next_token_hash: sha256Hex(nextGrant),
    })) as {
      space: {
        slug: string;
        name: string;
        icon: string;
        purpose: "personal" | "work" | "study" | "blank";
        is_private: boolean;
        created_at: number;
      };
    };

    const template = resolveTemplate(loaded.space.purpose);

    return {
      space: loaded.space,
      template: {
        templateKey: template.templateKey,
        tools: template.tools.map((tool) => ({ key: tool.key, label: tool.label })),
      },
      grant: nextGrant,
    };
  },
});
