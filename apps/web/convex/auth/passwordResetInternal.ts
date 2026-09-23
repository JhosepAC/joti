import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

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

export const getRecentByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("auth_password_resets")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    if (all.length === 0) return null;
    // most recent by created_at
    all.sort((a, b) => b.created_at - a.created_at);
    const latest = all[0];
    const countLastHour = all.filter((r) => r.created_at > Date.now() - 60 * 60 * 1000).length;
    return { latest, countLastHour };
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
    const all = await ctx.db.query("auth_password_resets").collect();
    let deleted = 0;
    for (const r of all) {
      if (r.expires_at < Date.now() - 24 * 60 * 60 * 1000 || r.used_at) {
        // keep used for audit 24h, then clean? For now delete expired+used after 24h
        if (r.expires_at < Date.now() || r.used_at) {
          await ctx.db.delete(r._id);
          deleted++;
        }
      }
    }
    return { deleted };
  },
});
