import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { findGrantByHash, requireUsableGrant, insertGrant } from "./grantStore";
import { CLAIM_SCOPE_ACCOUNT } from "./constants";

const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export const create = internalMutation({
  args: {
    email: v.string(),
    claim_hash: v.string(),
    token_hash: v.string(),
    next_claim_hash: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await findGrantByHash(ctx, args.claim_hash);
    requireUsableGrant(grant, {
      email: args.email,
      scope: CLAIM_SCOPE_ACCOUNT,
    });
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user || user.deleted_at || !user.email_verified_at)
      throw new ConvexError("This session is no longer valid.");
    const sessions = await ctx.db
      .query("auth_sessions")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    const active = sessions
      .filter((session) => session.expires_at > Date.now())
      .sort((a, b) => a.created_at - b.created_at);
    for (const session of sessions)
      if (session.expires_at <= Date.now()) await ctx.db.delete(session._id);
    for (const session of active.slice(0, Math.max(0, active.length - 9)))
      await ctx.db.delete(session._id);
    const expiresAt = Date.now() + LIFETIME_MS;
    await ctx.db.insert("auth_sessions", {
      token_hash: args.token_hash,
      user_id: user._id,
      created_at: Date.now(),
      expires_at: expiresAt,
    });
    await ctx.db.delete(grant._id);
    await insertGrant(ctx, {
      email: user.email,
      user_id: user._id,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: args.next_claim_hash,
    });
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();
    return { email: user.email, expiresAt, locale: profile?.locale };
  },
});

export const resume = internalMutation({
  args: { token_hash: v.string(), claim_hash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (!session) return null;
    if (session.expires_at <= Date.now()) {
      await ctx.db.delete(session._id);
      return null;
    }
    const user = await ctx.db.get(session.user_id);
    if (!user || user.deleted_at || !user.email_verified_at) {
      await ctx.db.delete(session._id);
      return null;
    }
    const key = `session-resume:${session._id}`;
    const quota = await ctx.db
      .query("auth_rate_limits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (quota && Date.now() - quota.window_start < 3600000) {
      if (quota.count >= 120)
        throw new ConvexError({
          code: "RATE_LIMITED",
          message: "Please try again later.",
        });
      await ctx.db.patch(quota._id, { count: quota.count + 1 });
    } else if (quota)
      await ctx.db.patch(quota._id, { count: 1, window_start: Date.now() });
    else
      await ctx.db.insert("auth_rate_limits", {
        key,
        count: 1,
        window_start: Date.now(),
      });
    await insertGrant(ctx, {
      email: user.email,
      user_id: user._id,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: args.claim_hash,
    });
    return { email: user.email };
  },
});

export const revoke = internalMutation({
  args: { token_hash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
      const user = await ctx.db.get(session.user_id);
      if (user) {
        const grants = await ctx.db
          .query("auth_claim_grants")
          .withIndex("by_email", (q) => q.eq("email", user.email))
          .collect();
        for (const grant of grants) await ctx.db.delete(grant._id);
      }
    }
  },
});

export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("auth_sessions")
      .withIndex("by_expires_at", (q) => q.lte("expires_at", Date.now()))
      .take(500);
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length };
  },
});
