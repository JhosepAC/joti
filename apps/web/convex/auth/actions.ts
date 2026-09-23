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

    // 2. Enforce email verification (must be verified within last 30 min)
    const verification = (await ctx.runQuery(internal.auth.verificationInternal.getByEmail, {
      email: cleanEmail,
    })) as { verified_at?: number; expires_at: number } | null;
    if (!verification?.verified_at) {
      throw new ConvexError({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified. Please verify your code first." });
    }
    if (Date.now() - verification.verified_at > 30 * 60 * 1000) {
      throw new ConvexError({ code: "EMAIL_NOT_VERIFIED", message: "Verification expired. Please request a new code." });
    }

    // 3. Pre-check uniqueness (fast fail; mutation re-checks for race condition)
    const emailAvailable: boolean = await ctx.runQuery(api.auth.queries.isEmailAvailable, {
      email: cleanEmail,
    });
    if (!emailAvailable) throw new ConvexError("Email is already registered.");

    const usernameAvailable: boolean = await ctx.runQuery(api.auth.queries.isUsernameAvailable, {
      username: cleanUsername,
    });
    if (!usernameAvailable) throw new ConvexError("Username is already taken.");

    // 4. Hash password (bcryptjs — pure JS, Convex-compatible)
    const salt = await bcrypt.genSalt(BCRYPT_COST);
    const passwordHash = await bcrypt.hash(args.password, salt);

    // 5. Create user + profile atomically
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
// Register Pending — creates inactive account on step 1 (email+password) before verification
// Spec: user adds email/password → account already created (inactive) → mandatory verify
// ──────────────────────────────────────────────────────────

export const registerPending = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    validatePassword(args.password, cleanEmail);

    const salt = await bcrypt.genSalt(BCRYPT_COST);
    const hash = await bcrypt.hash(args.password, salt);

    const { userId } = (await ctx.runMutation(internal.auth.mutations.createPendingUser, {
      email: cleanEmail,
      password_hash: hash,
    })) as { userId: string };

    // Generate and send verification code (same as verification:requestEmailCode)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await ctx.runMutation(internal.auth.verificationInternal.upsertCode, {
      email: cleanEmail,
      code,
      expires_at: expiresAt,
    });
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "Joti <onboarding@resend.dev>",
            reply_to: "jhosepjamil@gmail.com",
            to: [cleanEmail],
            subject: "Your Joti verification code",
            html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
            text: `Your Joti verification code is ${code}. It expires in 10 minutes.`,
          }),
        });
      } catch (e) {
        console.warn("[Email] failed", e);
      }
    } else {
      console.log(`[Email] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code} | Expires: ${new Date(expiresAt).toISOString()}`);
    }

    return { userId, expiresAt };
  },
});

export const completeProfile: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const cleanEmail = validateEmail(args.email);
    const user = (await ctx.runQuery(api.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as { _id: string; email_verified_at?: number } | null;
    if (!user) throw new ConvexError("Account not found. Please register again.");
    if (!user.email_verified_at) throw new ConvexError({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified. Please verify first." });

    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    const usernameAvailable: boolean = await ctx.runQuery(api.auth.queries.isUsernameAvailable, { username: cleanUsername });
    if (!usernameAvailable) throw new ConvexError("Username is already taken.");

    return await ctx.runMutation(internal.auth.mutations.completeProfile, {
      userId: user._id as never,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale,
      timezone: args.timezone,
    });
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
      email_verified_at?: number;
      failed_login_attempts: number;
      locked_until?: number;
      deleted_at?: number;
    } | null = await ctx.runQuery(api.auth.queries.getUserByEmail, { email: cleanEmail });

    // Generic error to avoid user enumeration
    const invalidCredentials = new ConvexError("Invalid email or password.");

    if (!user) throw invalidCredentials;
    if (user.deleted_at) throw new ConvexError("Account has been deactivated.");
    if (!user.email_verified_at) {
      throw new ConvexError({ code: "EMAIL_NOT_VERIFIED", message: "Please verify your email before signing in. Check your inbox for the code." });
    }
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
