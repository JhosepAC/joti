import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { VERIFICATION_MAX_ATTEMPTS } from "./constants";

// ---------------------------------------------------------------------------
// This module runs in the V8 isolate, so it must not import anything that
// touches `node:*` (bcryptjs, node:crypto). The caller -- the Node action in
// verification.ts -- hashes the code (peppered) and passes the digests in,
// and the comparisons below are pure JS.
// ---------------------------------------------------------------------------

/** Length-independent, data-independent string comparison. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const upsertCode = internalMutation({
  args: { email: v.string(), code_hash: v.string(), expires_at: v.number() },
  handler: async (ctx, args) => {
    // Only the peppered SHA-256 digest is persisted, so a leaked database dump
    // or log entry does not hand out live verification codes (and cannot be
    // brute-forced offline without the server-side pepper).
    const existing = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        code: undefined,
        code_hash: args.code_hash,
        expires_at: args.expires_at,
        attempts: 0,
        verified_at: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("auth_email_verifications", {
      email: args.email,
      code: undefined,
      code_hash: args.code_hash,
      expires_at: args.expires_at,
      attempts: 0,
    });
  },
});

export const verifyCode = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
    code_hash: v.string(),
    code_hash_legacy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!record) return { verified: false };
    if (record.expires_at < Date.now()) return { verified: false };
    if (record.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      throw new ConvexError("Too many attempts. Request a new code.");
    }

    const matchesPeppered =
      record.code_hash !== undefined && constantTimeEqual(record.code_hash, args.code_hash);
    const matchesLegacy =
      !matchesPeppered &&
      args.code_hash_legacy !== undefined &&
      record.code_hash !== undefined &&
      constantTimeEqual(record.code_hash, args.code_hash_legacy);
    const matches =
      matchesPeppered ||
      matchesLegacy ||
      (record.code_hash === undefined &&
        // Legacy row written before codes were hashed: compare the raw code
        // in constant time so the path stays timing-safe, then let the next
        // upsert migrate the row to a digest.
        record.code !== undefined &&
        constantTimeEqual(record.code, args.code));

    if (!matches) {
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      return { verified: false };
    }

    // Burn the code so a captured request cannot be replayed.
    await ctx.db.patch(record._id, {
      verified_at: Date.now(),
      attempts: 0,
      code: undefined,
      code_hash: undefined,
    });
    return { verified: true };
  },
});

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/** Removes the verification row entirely. */
export const clearByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (record) await ctx.db.delete(record._id);
  },
});

/**
 * Deletes long-dead verification rows. Runs on a schedule (see
 * convex/crons.ts). The grace period matters: `verified_at` rows stay valid
 * for registration for 30 minutes after redemption, so only rows dead for
 * over a day are swept -- anything needed by the cooldown (60s) or the
 * freshness gate (30min) is far younger.
 */
export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db.query("auth_email_verifications").collect();
    let deleted = 0;
    for (const row of rows) {
      if (row.expires_at < cutoff) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
