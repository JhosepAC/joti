import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  SPACE_SLUG_MAX_ATTEMPTS,
  type SpaceIcon,
  type SpacePurpose,
} from "./constants";
import { toSlugBase, validateSlug, validateSpaceIcon, validateSpaceName, validateSpacePurpose } from "./validators";
import { validateEmail } from "../auth/validators";
import { CLAIM_SCOPE_ACCOUNT, CLAIM_SCOPE_SPACE } from "../auth/constants";
import {
  SESSION_INVALID,
  burnGrant,
  findGrantByHash,
  insertGrant,
  requireUsableGrant,
  supersedeGrants,
} from "../auth/grantStore";

// ---------------------------------------------------------------------------
// Space creation and workspace reads.
//
// Grant checks live INSIDE these mutations (not in the calling action) so
// check-and-burn is a single atomic transaction: concurrent requests with the
// same grant cannot both pass, and a validation failure rolls everything --
// including the burn -- back, leaving the caller able to fix the form and
// retry with the same grant. A check performed one layer up is a check that
// can be raced; a burn performed one layer up strands the user on retryable
// errors. Doing both here avoids each failure in turn.
// ---------------------------------------------------------------------------

export const createFirstSpace = internalMutation({
  args: {
    email: v.string(),
    token_hash: v.string(),
    name: v.string(),
    icon: v.string(),
    purpose: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    spaceId: Id<"spaces">;
    slug: string;
    name: string;
    icon: SpaceIcon;
    purpose: SpacePurpose;
    owner_id: Id<"auth_users">;
  }> => {
    const cleanEmail = validateEmail(args.email);
    const name = validateSpaceName(args.name);
    const icon = validateSpaceIcon(args.icon);
    const purpose = validateSpacePurpose(args.purpose);

    // Owner resolved from the grant, never from an argument: a caller cannot
    // choose whose space to create. Read-only so far -- nothing is written
    // until every check below has passed.
    const grant = await findGrantByHash(ctx, args.token_hash);
    requireUsableGrant(grant, { email: cleanEmail, scope: CLAIM_SCOPE_ACCOUNT });
    if (!grant.user_id) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: SESSION_INVALID });
    }
    const ownerId = grant.user_id;

    const user = await ctx.db.get(ownerId);
    if (!user || user.deleted_at) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Account not found." });
    }

    // The onboarding is only reachable with a completed profile, and that is
    // enforced here rather than trusted from the client.
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", ownerId))
      .first();
    if (!profile) {
      throw new ConvexError({
        code: "PROFILE_REQUIRED",
        message: "Completa tu perfil antes de crear tu espacio.",
      });
    }

    // "First space" is enforced, not just named that way: this endpoint is the
    // onboarding step, so it refuses once a space exists. Re-running the flow is
    // therefore idempotent by construction and cannot be used to farm spaces.
    const existing = await ctx.db
      .query("spaces")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", ownerId))
      .filter((q) => q.eq(q.field("deleted_at"), undefined))
      .first();
    if (existing && !existing.deleted_at) {
      throw new ConvexError({
        code: "SPACE_ALREADY_EXISTS",
        message: "Ya tienes un espacio. Puedes entrar a él desde el inicio.",
      });
    }

    // Slug is globally unique because `/w/<slug>` has no owner segment, so two
    // accounts naming their space the same thing must still be addressable.
    // Guessability is not a disclosure here: the route only renders a space to a
    // caller holding a grant bound to that space.
    const base = toSlugBase(name);
    let slug = base;
    for (let attempt = 2; attempt <= SPACE_SLUG_MAX_ATTEMPTS; attempt += 1) {
      const taken = await ctx.db
        .query("spaces")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!taken) break;
      slug = `${base}-${attempt}`;
    }
    const conflict = await ctx.db
      .query("spaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (conflict) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "No pudimos generar una dirección única para este espacio. Prueba con otro nombre.",
      });
    }

    const spaceId = await ctx.db.insert("spaces", {
      owner_id: ownerId,
      name,
      slug,
      icon,
      purpose,
      // Spaces start private; inviting collaborators is a later step and the
      // onboarding shows this as an informational badge, not an input.
      is_private: true,
      created_at: Date.now(),
    });

    // Burn only now that the space exists: everything above is one atomic
    // transaction, so a validation failure rolls the burn back too and the
    // caller keeps a live grant for the retry.
    await burnGrant(ctx, grant._id);

    return { spaceId, slug, name, icon, purpose, owner_id: ownerId };
  },
});

// ---------------------------------------------------------------------------
// Workspace bootstrap for `/w/<slug>`.
//
// Same atomicity contract as creation: validate the grant, load the space,
// burn the presented grant and insert its rotated successor in ONE
// transaction. Two concurrent tabs presenting the same grant therefore cannot
// both pass -- exactly one wins the rotation. The successor's raw token is
// minted by the calling action (it needs Node randomness) and passed in as a
// digest; this mutation only stores it.
// ---------------------------------------------------------------------------

export const loadWorkspace = internalMutation({
  args: {
    token_hash: v.string(),
    slug: v.string(),
    next_token_hash: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanSlug = validateSlug(args.slug);

    // No email check: the action does not know the address (the space store
    // carries no email), exactly like the previous peek-based flow. The grant
    // is still bound to one space_id, which is what authorizes this read.
    const grant = await findGrantByHash(ctx, args.token_hash);
    requireUsableGrant(grant, { scope: CLAIM_SCOPE_SPACE });
    if (!grant.space_id || !grant.user_id) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: SESSION_INVALID });
    }

    const space = await ctx.db.get(grant.space_id);
    // The grant is for a space; the URL names a (possibly different) one.
    if (!space || space.deleted_at || space.slug !== cleanSlug) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "This space is not available.",
      });
    }

    // Rotate inside the same transaction: burn the presented grant, drop any
    // leaked siblings for the pair (same supersede rule as issuance), and
    // store the successor. A concurrent request with the same token finds no
    // row and fails instead of double-passing a peek.
    await burnGrant(ctx, grant._id);
    await supersedeGrants(ctx, { scope: CLAIM_SCOPE_SPACE, email: grant.email });
    await insertGrant(ctx, {
      email: grant.email,
      user_id: grant.user_id,
      scope: CLAIM_SCOPE_SPACE,
      space_id: space._id,
      token_hash: args.next_token_hash,
    });

    return {
      space: {
        slug: space.slug,
        name: space.name,
        icon: space.icon,
        purpose: space.purpose,
        is_private: space.is_private,
        created_at: space.created_at,
      },
    };
  },
});
