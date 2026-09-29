"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
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
// ---------------------------------------------------------------------------

const SESSION_INVALID = "This session is no longer valid. Please sign in again.";

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
// The owner is resolved from the grant, never from an argument: a caller cannot
// choose whose space to create. The account grant is burned only after the space
// exists, so a validation failure leaves the user able to fix the form and retry
// instead of stranding them with a dead token.
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

    const grant = (await ctx.runQuery(internal.auth.claimGrants.peek, {
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: sha256Hex(args.claim),
    })) as { email: string; userId: Id<"auth_users"> | null; spaceId: Id<"spaces"> | null };

    if (grant.email !== cleanEmail || !grant.userId) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: SESSION_INVALID });
    }
    const ownerId = grant.userId;

    const created = (await ctx.runMutation(internal.spaces.mutations.createFirstSpace, {
      owner_id: ownerId,
      name,
      icon,
      purpose,
    })) as {
      spaceId: Id<"spaces">;
      slug: string;
      name: string;
      icon: string;
      purpose: string;
    };

    // The space exists, so the onboarding grant has done its job.
    await ctx.runMutation(internal.auth.claimGrants.consume, {
      email: cleanEmail,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: sha256Hex(args.claim),
    });

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
        user_id: ownerId,
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
    const tokenHash = sha256Hex(args.grant);

    const grant = (await ctx.runQuery(internal.auth.claimGrants.peek, {
      scope: CLAIM_SCOPE_SPACE,
      token_hash: tokenHash,
    })) as { email: string; userId: Id<"auth_users"> | null; spaceId: Id<"spaces"> | null };

    if (!grant.spaceId || !grant.userId) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: SESSION_INVALID });
    }

    const space = (await ctx.runQuery(internal.spaces.queries.getById, {
      spaceId: grant.spaceId,
    })) as {
      _id: Id<"spaces">;
      owner_id: Id<"auth_users">;
      name: string;
      slug: string;
      icon: string;
      purpose: "personal" | "work" | "study" | "blank";
      is_private: boolean;
      created_at: number;
    } | null;

    // The grant is for a space; the URL names a (possibly different) one.
    if (!space || space.slug !== cleanSlug) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "This space is not available.",
      });
    }

    // Burn the presented grant before issuing its replacement: `issue` clears
    // every grant for the same (scope, email), so consuming afterwards would be
    // deleting the row that was just written.
    await ctx.runMutation(internal.auth.claimGrants.consume, {
      email: grant.email,
      scope: CLAIM_SCOPE_SPACE,
      space_id: space._id,
      token_hash: tokenHash,
    });

    const nextGrant = await mintGrant(ctx, {
      email: grant.email,
      user_id: grant.userId,
      scope: CLAIM_SCOPE_SPACE,
      space_id: space._id,
    });

    const template = resolveTemplate(space.purpose);

    return {
      space: {
        slug: space.slug,
        name: space.name,
        icon: space.icon,
        purpose: space.purpose,
        is_private: space.is_private,
        created_at: space.created_at,
      },
      template: {
        templateKey: template.templateKey,
        tools: template.tools.map((tool) => ({ key: tool.key, label: tool.label })),
      },
      grant: nextGrant,
    };
  },
});
