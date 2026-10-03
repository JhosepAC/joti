import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  SESSION_EXPIRED,
  SESSION_INVALID,
  burnGrant,
  findGrantByHash,
  insertGrant,
  requireUsableGrant,
  supersedeGrants,
} from "./grantStore";

// Note: this module exports Convex functions, so it runs in the V8 isolate and
// must not import anything touching `node:*`. The raw-token generator lives in
// `./crypto` (Node runtime) instead, and callers pass the digest in.
//
// Storage policy (lookup, scope/email/binding checks, expiry, rotation) lives
// in `./grantStore` and is shared with the spaces mutations and the avatar
// upload check, so there is exactly one place where grant semantics can drift.
//
// ---------------------------------------------------------------------------
// SECURITY
//
// Short-lived proof that the caller controls an email address — and, for the
// `space` scope, that they may act on one specific space.
//
// The app has no session layer, so there is no identity for Convex to check
// against. Without this, "authorization" reduced to *knows a verified email
// address*, which let anyone claim a registered-but-incomplete account's
// profile or mint avatar upload URLs for it.
//
// A grant is:
//   * issued only after a successful password check or a successful email-code
//     redemption, i.e. only once the caller has actually proved they control the
//     address;
//   * stored as a SHA-256 digest, so a database dump yields nothing usable;
//   * bound to one email address, one scope, and optionally one space;
//   * short-lived (15 minutes).
//
// Steps *rotate* rather than share: the step that finishes a stage consumes the
// grant it was given and mints the one the next stage needs. That keeps a
// captured token from being replayed against a later step.
// ---------------------------------------------------------------------------

function invalid(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message });
}

/** Mints a grant. Returns nothing — the raw token is the caller's own input. */
export const issue = internalMutation({
  args: {
    email: v.string(),
    user_id: v.optional(v.id("auth_users")),
    space_id: v.optional(v.id("spaces")),
    scope: v.string(),
    token_hash: v.string(),
  },
  handler: async (ctx, args) => {
    await supersedeGrants(ctx, { scope: args.scope, email: args.email });
    return await insertGrant(ctx, {
      email: args.email,
      user_id: args.user_id,
      scope: args.scope,
      space_id: args.space_id,
      token_hash: args.token_hash,
    });
  },
});

/**
 * Resolves a grant without consuming it.
 *
 * Used when the same token authorises a read *and* a later write, or when the
 * subject has to be known before the write is attempted (space creation needs
 * the owner id). The write path consumes the grant once it succeeds, so a
 * failed attempt leaves the user able to retry.
 */
export const peek = internalQuery({
  args: { token_hash: v.string(), scope: v.string() },
  handler: async (ctx, args) => {
    const grant = await findGrantByHash(ctx, args.token_hash);

    // One message for "unknown token", "wrong scope" and "not yet expired for
    // someone else" so a grant cannot be probed for existence.
    // (`requireUsableGrant` throws on null, so `grant` narrows to non-null.)
    requireUsableGrant(grant, { scope: args.scope });

    return {
      email: grant.email,
      userId: (grant.user_id ?? null) as Id<"auth_users"> | null,
      spaceId: (grant.space_id ?? null) as Id<"spaces"> | null,
    };
  },
});

/**
 * Validates a grant against an address and deletes it, so a captured token
 * cannot be reused for a second submission of the same step.
 */
export const consume = internalMutation({
  args: {
    token_hash: v.string(),
    email: v.string(),
    scope: v.string(),
    /** When set, the grant must be bound to exactly this space. */
    space_id: v.optional(v.id("spaces")),
  },
  handler: async (ctx, args) => {
    const grant = await findGrantByHash(ctx, args.token_hash);
    if (!grant || grant.scope !== args.scope) invalid(SESSION_INVALID);
    if (grant.email !== args.email) invalid(SESSION_INVALID);
    if (args.space_id !== undefined && grant.space_id !== args.space_id) {
      invalid(SESSION_INVALID);
    }
    if (grant.expires_at < Date.now()) {
      await burnGrant(ctx, grant._id);
      invalid(SESSION_EXPIRED);
    }

    await burnGrant(ctx, grant._id);
    return {
      userId: (grant.user_id ?? null) as Id<"auth_users"> | null,
      spaceId: (grant.space_id ?? null) as Id<"spaces"> | null,
    };
  },
});

/** Drops grants for an address that were never redeemed. */
export const clearByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("auth_claim_grants")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { removed: rows.length };
  },
});

/**
 * Deletes dead grants: expired ones, which can never validate again. Runs on
 * a schedule (see convex/crons.ts) so the table stays bounded -- every `issue`
 * already supersedes live siblings, so only leftovers of abandoned flows
 * accumulate here.
 */
export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("auth_claim_grants").collect();
    let deleted = 0;
    for (const row of rows) {
      if (row.expires_at < now) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
