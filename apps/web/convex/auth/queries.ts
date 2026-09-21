import { query } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// ──────────────────────────────────────────────────────────
// Internal helpers — shared read logic
// ──────────────────────────────────────────────────────────

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!user || user.deleted_at) return null;
    return user;
  },
});

export const getProfileByUserId = query({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .first();
    return profile;
  },
});

export const getProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.username.trim().toLowerCase();
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    return profile;
  },
});

export const isEmailAvailable = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!existing || existing.deleted_at) return true;
    return false;
  },
});

export const isUsernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.username.trim().toLowerCase();
    const existing = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    return existing === null;
  },
});

export const getUserWithProfileByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!user || user.deleted_at) return null;
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();
    // Strip sensitive fields before returning
    const { password_hash: _ph, ...safeUser } = user as Record<string, unknown>;
    return { user: safeUser, profile };
  },
});

export const getOAuthAccount = query({
  args: {
    provider: v.union(v.literal("google")),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("auth_oauth_accounts")
      .withIndex("by_provider_and_account", (q) =>
        q.eq("provider", args.provider).eq("provider_account_id", args.providerAccountId),
      )
      .first();
    return account;
  },
});

// Helper to fetch authenticated user (placeholder — wire to Convex Auth / session later)
export const getCurrentUser = query({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deleted_at) throw new ConvexError("User not found.");
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .first();
    const { password_hash: _ph, ...safeUser } = user as Record<string, unknown>;
    return { user: safeUser, profile };
  },
});
