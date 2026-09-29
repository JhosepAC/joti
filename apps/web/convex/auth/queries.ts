import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// ---------------------------------------------------------------------------
// SECURITY: every function in this file touches credential material, so they
// are all `internalQuery` -- unreachable from the public API. The single public
// query (`getPublicProfileByUsername`) returns display-only fields by
// construction, so there is no path that can leak `password_hash`.
//
// Previously `getUserByEmail` was a PUBLIC query returning the whole
// `auth_users` document, which published every user's bcrypt hash.
// ---------------------------------------------------------------------------

type AuthUser = {
  _id: string;
  email: string;
  password_hash?: string;
  email_verified_at?: number;
  last_login_at?: number;
  failed_login_attempts: number;
  locked_until?: number;
  deleted_at?: number;
};

/** Strips every credential field. Use before returning a user to any caller. */
function sanitizeUser(user: AuthUser | null): Omit<AuthUser, "password_hash"> | null {
  if (!user) return null;
  const { password_hash: _discarded, ...safe } = user;
  void _discarded;
  return safe;
}

export const getUserByEmail = internalQuery({
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

/** Same lookup, but with the password hash removed. */
export const getSafeUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    return sanitizeUser(user && !user.deleted_at ? user : null);
  },
});

export const getProfileByUserId = internalQuery({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .first();
  },
});

export const getUserWithProfileByEmail = internalQuery({
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
    return { user: sanitizeUser(user), profile };
  },
});

export const getOAuthAccount = internalQuery({
  args: {
    provider: v.union(v.literal("google")),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_oauth_accounts")
      .withIndex("by_provider_and_account", (q) =>
        q.eq("provider", args.provider).eq("provider_account_id", args.providerAccountId),
      )
      .first();
  },
});

export const isEmailAvailable = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    return !existing || Boolean(existing.deleted_at);
  },
});

export const isUsernameAvailable = internalQuery({
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

export const getUserById = internalQuery({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return sanitizeUser(user && !user.deleted_at ? user : null);
  },
});

// --- Public surface -------------------------------------------------------
// Only display data, no email, no credential material, no existence oracle
// for the auth tables.

export const getPublicProfileByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.username.trim().toLowerCase();
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .first();
    if (!profile) return null;
    const user = await ctx.db.get(profile.user_id);
    if (!user || user.deleted_at) return null;
    return {
      username: profile.username,
      display_name: profile.display_name,
      avatar: profile.avatar,
      bio: profile.bio,
    };
  },
});

/**
 * Placeholder for a future session-backed lookup. It is intentionally
 * `internalQuery`: as a public query it allowed any caller to read any
 * account by guessing `userId` (IDOR).
 */
export const getCurrentUser = internalQuery({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deleted_at) throw new ConvexError("User not found.");
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .first();
    return { user: sanitizeUser(user), profile };
  },
});
