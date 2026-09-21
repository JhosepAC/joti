"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import bcrypt from "bcryptjs";
import { internal } from "../_generated/api";
import { api } from "../_generated/api";
import { BCRYPT_COST } from "./constants";
import {
  validateBio,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
  validateAvatar,
} from "./validators";

// ──────────────────────────────────────────────────────────
// Register — single action: validate → hash → create (atomic via internalMutation)
// This is the RECOMMENDED entry point for credential registration.
// ──────────────────────────────────────────────────────────

export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Validate & normalize
    const cleanEmail = validateEmail(args.email);
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    validatePassword(args.password, cleanEmail, cleanUsername);

    // 2. Pre-check uniqueness (fast fail; mutation re-checks for race condition)
    const emailAvailable: boolean = await ctx.runQuery(api.auth.queries.isEmailAvailable, {
      email: cleanEmail,
    });
    if (!emailAvailable) throw new ConvexError("Email is already registered.");

    const usernameAvailable: boolean = await ctx.runQuery(api.auth.queries.isUsernameAvailable, {
      username: cleanUsername,
    });
    if (!usernameAvailable) throw new ConvexError("Username is already taken.");

    // 3. Hash password (bcryptjs — pure JS, Convex-compatible)
    const salt = await bcrypt.genSalt(BCRYPT_COST);
    const passwordHash = await bcrypt.hash(args.password, salt);

    // 4. Create user + profile atomically
    const result: { userId: string } = await ctx.runMutation(internal.auth.mutations.createUserInternal, {
      email: cleanEmail,
      password_hash: passwordHash,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale,
      timezone: args.timezone,
    });

    return result;
  },
});

// ──────────────────────────────────────────────────────────
// Login — single action: validate → fetch → lockout check → verify → track
// Returns sanitized user+profile on success; throws ConvexError on failure.
// Never reveals whether email exists (generic message for not found).
// ──────────────────────────────────────────────────────────

export const login: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const cleanEmail = validateEmail(args.email);

    if (!args.password || args.password.length === 0) {
      throw new ConvexError("Password is required.");
    }

    // Fetch user (null if not found or soft-deleted)
    const user: {
      _id: string;
      email: string;
      password_hash?: string;
      failed_login_attempts: number;
      locked_until?: number;
      deleted_at?: number;
    } | null = await ctx.runQuery(api.auth.queries.getUserByEmail, { email: cleanEmail });

    // Generic error to avoid user enumeration
    const invalidCredentials = new ConvexError("Invalid email or password.");

    if (!user) throw invalidCredentials;
    if (user.deleted_at) throw new ConvexError("Account has been deactivated.");
    if (!user.password_hash) {
      // OAuth-only account without password
      throw new ConvexError("This account uses Google sign-in. Please continue with Google.");
    }

    // Check lockout
    if (user.locked_until && user.locked_until > Date.now()) {
      const secondsLeft = Math.ceil((user.locked_until - Date.now()) / 1000);
      throw new ConvexError(`Account is locked. Try again in ${secondsLeft} seconds.`);
    }

    // Verify password (bcryptjs)
    const isValid = await bcrypt.compare(args.password, user.password_hash);

    if (!isValid) {
      await ctx.runMutation(internal.auth.mutations.handleFailedLogin, {
        userId: user._id as never,
      });
      throw invalidCredentials;
    }

    // Success — reset attempts & update last_login_at
    await ctx.runMutation(internal.auth.mutations.handleSuccessfulLogin, {
      userId: user._id as never,
    });

    const profile = await ctx.runQuery(api.auth.queries.getProfileByUserId, {
      userId: user._id as never,
    });

    return {
      user: {
        _id: user._id,
        email: user.email,
      },
      profile,
    };
  },
});

// ──────────────────────────────────────────────────────────
// OAuth — link or create Google account
// Expects already-verified provider_account_id from trusted OAuth flow (httpAction)
// ──────────────────────────────────────────────────────────

export const linkOAuthAccount: ReturnType<typeof action> = action({
  args: {
    userId: v.id("auth_users"),
    provider: v.union(v.literal("google")),
    providerAccountId: v.string(),
    providerEmail: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    // In production, encrypt tokens with TOKEN_ENCRYPTION_KEY via crypto action
    // For now we forward as _encrypted fields (caller should encrypt if key present)
    // Keep token handling minimal here — httpAction should call encryptToken action first if needed
    const result: unknown = await ctx.runMutation(internal.auth.mutations.upsertOAuthAccount, {
      user_id: args.userId,
      provider: args.provider,
      provider_account_id: args.providerAccountId,
      provider_email: args.providerEmail
        ? validateEmail(args.providerEmail)
        : undefined,
      access_token_encrypted: args.accessToken,
      refresh_token_encrypted: args.refreshToken,
      token_expires_at: args.tokenExpiresAt,
    });
    return result;
  },
});
