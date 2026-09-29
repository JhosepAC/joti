import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { CLAIM_GRANT_EXPIRY_MS } from "./constants";

// Note: this module exports Convex functions, so it runs in the V8 isolate and
// must not import anything touching `node:*`. The raw-token generator lives in
// `./crypto` (Node runtime) instead, and callers pass the digest in.
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

const SESSION_INVALID = "This session is no longer valid. Please sign in again.";
const SESSION_EXPIRED = "This session expired. Please sign in again.";

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
    // One live grant per (scope, subject). Rotation means a new grant always
    // supersedes the previous one, which also keeps the table bounded: without
    // this, every login would leave another row behind until it expired.
    const superseded = await ctx.db
      .query("auth_claim_grants")
      .withIndex("by_scope_and_email", (q) =>
        q.eq("scope", args.scope).eq("email", args.email),
      )
      .collect();
    for (const row of superseded) await ctx.db.delete(row._id);

    const now = Date.now();
    await ctx.db.insert("auth_claim_grants", {
      token_hash: args.token_hash,
      email: args.email,
      user_id: args.user_id,
      scope: args.scope,
      space_id: args.space_id,
      issued_at: now,
      expires_at: now + CLAIM_GRANT_EXPIRY_MS,
    });
    return { expiresAt: now + CLAIM_GRANT_EXPIRY_MS };
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
    const grant = await ctx.db
      .query("auth_claim_grants")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();

    // One message for "unknown token", "wrong scope" and "not yet expired for
    // someone else" so a grant cannot be probed for existence.
    if (!grant || grant.scope !== args.scope) invalid(SESSION_INVALID);
    if (grant.expires_at < Date.now()) invalid(SESSION_EXPIRED);

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
    const grant = await ctx.db
      .query("auth_claim_grants")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();

    if (!grant || grant.scope !== args.scope) invalid(SESSION_INVALID);
    if (grant.email !== args.email) invalid(SESSION_INVALID);
    if (args.space_id !== undefined && grant.space_id !== args.space_id) {
      invalid(SESSION_INVALID);
    }
    if (grant.expires_at < Date.now()) {
      await ctx.db.delete(grant._id);
      invalid(SESSION_EXPIRED);
    }

    await ctx.db.delete(grant._id);
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
