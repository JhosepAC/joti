import { internalMutation, internalQuery } from "../_generated/server";
import { ConvexError, v } from "convex/values";

// Recheck and consume the link in the same transaction that updates credentials.
// Two concurrent actions may both finish bcrypt; only one may commit.
export const commitPasswordReset = internalMutation({
  args: { token_hash: v.string(), password_hash: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_password_resets")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (
      !record ||
      record.used_at !== undefined ||
      record.expires_at <= Date.now()
    ) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invalid or expired reset link.",
      });
    }
    const user = await ctx.db.get(record.user_id);
    if (!user || user.deleted_at || user.email !== record.email) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invalid or expired reset link.",
      });
    }
    await ctx.db.patch(user._id, {
      password_hash: args.password_hash,
      failed_login_attempts: 0,
      locked_until: undefined,
    });
    await ctx.db.patch(record._id, { used_at: Date.now() });
    // A password change invalidates all currently held authorizations.
    const grants = await ctx.db
      .query("auth_claim_grants")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .collect();
    for (const grant of grants) await ctx.db.delete(grant._id);
    const sessions = await ctx.db
      .query("auth_sessions")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    return { success: true };
  },
});

export const createResetToken = internalMutation({
  args: {
    user_id: v.id("auth_users"),
    email: v.string(),
    token_hash: v.string(),
    expires_at: v.number(),
  },
  handler: async (ctx, args) => {
    // Invalidate previous unused tokens for this user (single active link)
    const previous = await ctx.db
      .query("auth_password_resets")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.user_id))
      .collect();
    for (const r of previous) {
      if (!r.used_at && r.expires_at > Date.now()) {
        await ctx.db.delete(r._id);
      }
    }

    const id = await ctx.db.insert("auth_password_resets", {
      user_id: args.user_id,
      email: args.email,
      token_hash: args.token_hash,
      expires_at: args.expires_at,
      created_at: Date.now(),
    });
    return id;
  },
});

export const getByTokenHash = internalQuery({
  args: { token_hash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_password_resets")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
  },
});

export const deleteByTokenHash = internalMutation({
  args: { token_hash: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_password_resets")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (record) await ctx.db.delete(record._id);
    return { deleted: record !== null };
  },
});

export const markUsed = internalMutation({
  args: { token_hash: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_password_resets")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (!record) return null;
    await ctx.db.patch(record._id, { used_at: Date.now() });
    return record;
  },
});

export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Runs on a schedule (see convex/crons.ts). Used links are single-use and
    // dead, and expired links can never validate again, so both go promptly:
    // there is no audit consumer for these rows, and keeping them only feeds
    // the per-email scans in `getByTokenHash` paths.
    const now = Date.now();
    const all = await ctx.db.query("auth_password_resets").collect();
    let deleted = 0;
    for (const r of all) {
      if (r.used_at !== undefined || r.expires_at < now) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
