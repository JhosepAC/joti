import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  validateAvatar,
  validateBio,
  validateDisplayName,
  validateEmail,
  validateUsername,
} from "./validators";
import { LOCKOUT_DURATION_MS, MAX_FAILED_ATTEMPTS } from "./constants";

// ──────────────────────────────────────────────────────────
// Internal — atomic user + profile creation (called by public action)
// ──────────────────────────────────────────────────────────

export const createUserInternal = internalMutation({
  args: {
    email: v.string(),
    password_hash: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    // Re-check uniqueness inside mutation (optimistic concurrency safe)
    const existingEmail = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (existingEmail && !existingEmail.deleted_at) {
      throw new ConvexError("Email is already registered.");
    }

    const existingUsername = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existingUsername) {
      throw new ConvexError("Username is already taken.");
    }

    const userId = await ctx.db.insert("auth_users", {
      email: cleanEmail,
      password_hash: args.password_hash,
      email_verified_at: Date.now(),
      failed_login_attempts: 0,
    });

    await ctx.db.insert("auth_user_profiles", {
      user_id: userId,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale ?? "system",
      timezone: args.timezone ?? "system",
    });

    // Clean up verification record after successful registration
    const verification = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (verification) await ctx.db.delete(verification._id);

    return { userId };
  },
});

// ──────────────────────────────────────────────────────────
// Legacy public register — expects pre-hashed password (hashPassword action)
// Kept for compatibility with the initial proposal; prefer `api.auth.actions.register`
// ──────────────────────────────────────────────────────────

export const registerUser = mutation({
  args: {
    email: v.string(),
    password_hash: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    const existingEmail = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (existingEmail && !existingEmail.deleted_at) {
      throw new ConvexError("Email is already registered.");
    }

    const existingUsername = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existingUsername) {
      throw new ConvexError("Username is already taken.");
    }

    if (!args.password_hash || args.password_hash.length < 20) {
      throw new ConvexError("Invalid password hash.");
    }

    const userId = await ctx.db.insert("auth_users", {
      email: cleanEmail,
      password_hash: args.password_hash,
      failed_login_attempts: 0,
    });

    await ctx.db.insert("auth_user_profiles", {
      user_id: userId,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale ?? "system",
      timezone: args.timezone ?? "system",
    });

    return { userId };
  },
});

// ──────────────────────────────────────────────────────────
// Login attempt tracking — lockout after MAX_FAILED_ATTEMPTS
// ──────────────────────────────────────────────────────────

export const handleFailedLogin = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const newAttempts = user.failed_login_attempts + 1;
    let lockedUntil = user.locked_until;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    await ctx.db.patch(args.userId, {
      failed_login_attempts: newAttempts,
      locked_until: lockedUntil,
    });
  },
});

export const handleFailedLoginPublic = mutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const newAttempts = user.failed_login_attempts + 1;
    let lockedUntil = user.locked_until;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    await ctx.db.patch(args.userId, {
      failed_login_attempts: newAttempts,
      locked_until: lockedUntil,
    });
  },
});

export const handleSuccessfulLogin = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      failed_login_attempts: 0,
      locked_until: undefined,
      last_login_at: Date.now(),
    });
  },
});

export const handleSuccessfulLoginPublic = mutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      failed_login_attempts: 0,
      locked_until: undefined,
      last_login_at: Date.now(),
    });
  },
});

// ──────────────────────────────────────────────────────────
// OAuth — upsert Google account, encrypt tokens via action layer
// ──────────────────────────────────────────────────────────

export const upsertOAuthAccount = internalMutation({
  args: {
    user_id: v.id("auth_users"),
    provider: v.union(v.literal("google")),
    provider_account_id: v.string(),
    provider_email: v.optional(v.string()),
    access_token_encrypted: v.optional(v.string()),
    refresh_token_encrypted: v.optional(v.string()),
    token_expires_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auth_oauth_accounts")
      .withIndex("by_provider_and_account", (q) =>
        q.eq("provider", args.provider).eq("provider_account_id", args.provider_account_id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider_email: args.provider_email ?? existing.provider_email,
        access_token_encrypted: args.access_token_encrypted ?? existing.access_token_encrypted,
        refresh_token_encrypted: args.refresh_token_encrypted ?? existing.refresh_token_encrypted,
        token_expires_at: args.token_expires_at ?? existing.token_expires_at,
      });
      return { oauthAccountId: existing._id, created: false };
    }

    const oauthAccountId = await ctx.db.insert("auth_oauth_accounts", {
      user_id: args.user_id,
      provider: args.provider,
      provider_account_id: args.provider_account_id,
      provider_email: args.provider_email,
      access_token_encrypted: args.access_token_encrypted,
      refresh_token_encrypted: args.refresh_token_encrypted,
      token_expires_at: args.token_expires_at,
    });
    return { oauthAccountId, created: true };
  },
});

// Soft delete / restore (admin or user-initiated)
export const softDeleteUser = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { deleted_at: Date.now() });
  },
});
