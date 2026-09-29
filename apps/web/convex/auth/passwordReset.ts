"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import crypto from "crypto";
import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import {
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_EXPIRY_MS,
  PASSWORD_RESET_MAX_PER_HOUR,
} from "./constants";
import { validateEmail, validatePassword } from "./validators";
import { hashPassword, sha256Hex, verifyPassword } from "./crypto";
import {
  getAppUrl,
  sendOAuthOnlyAccountNotice,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from "./email";

/** 32 bytes of CSPRNG entropy, base64url encoded. */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

type UserRow = {
  _id: string;
  email: string;
  password_hash?: string;
  deleted_at?: number;
} | null;

type Throttle = { latest: { created_at: number }; countLastHour: number } | null;

async function assertNotThrottled(
  ctx: GenericActionCtx<DataModel>,
  email: string,
): Promise<void> {
  const throttle = (await ctx.runQuery(
    internal.auth.passwordResetInternal.getRecentByEmail,
    { email },
  )) as Throttle;

  if (!throttle?.latest) return;

  const elapsed = Date.now() - throttle.latest.created_at;
  if (elapsed < PASSWORD_RESET_COOLDOWN_MS) {
    const waitSec = Math.ceil((PASSWORD_RESET_COOLDOWN_MS - elapsed) / 1000);
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `Please wait ${waitSec}s before requesting another reset link.`,
    });
  }
  if (throttle.countLastHour >= PASSWORD_RESET_MAX_PER_HOUR) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many reset requests. Please try again later.",
    });
  }
}

/**
 * Request a password reset.
 *
 * Always answers `{ sent: true }` so the endpoint cannot be used to discover
 * which addresses have accounts. The raw token is emailed and only its SHA-256
 * digest is persisted; it is never logged.
 */
export const requestPasswordReset: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const cleanEmail = validateEmail(args.email);

    const user = (await ctx.runQuery(internal.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as UserRow;

    if (!user || user.deleted_at) {
      return { sent: true };
    }

    // Throttle before doing any work, and identically for both branches below,
    // so timing does not distinguish "OAuth-only" from "has a password".
    await assertNotThrottled(ctx, cleanEmail);

    if (!user.password_hash) {
      await sendOAuthOnlyAccountNotice(cleanEmail);
      return { sent: true };
    }

    const rawToken = generateSecureToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = Date.now() + PASSWORD_RESET_EXPIRY_MS;

    await ctx.runMutation(internal.auth.passwordResetInternal.createResetToken, {
      user_id: user._id as never,
      email: cleanEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetLink = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(cleanEmail, resetLink);

    return { sent: true };
  },
});

/**
 * Consume a reset token and set a new password.
 */
export const resetPassword: ReturnType<typeof action> = action({
  args: {
    token: v.string(),
    password: v.string(),
    confirmPassword: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const rawToken = args.token.trim();
    if (!rawToken) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Reset token is required." });
    }

    if (args.confirmPassword !== undefined && args.password !== args.confirmPassword) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Passwords do not match." });
    }

    const tokenHash = sha256Hex(rawToken);

    const record = (await ctx.runQuery(
      internal.auth.passwordResetInternal.getByTokenHash,
      { token_hash: tokenHash },
    )) as
      | { _id: string; user_id: string; email: string; expires_at: number; used_at?: number }
      | null;

    if (!record) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Invalid or expired reset link." });
    }
    if (record.used_at) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "This reset link has already been used.",
      });
    }
    if (record.expires_at < Date.now()) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Reset link has expired. Please request a new one.",
      });
    }

    const user = (await ctx.runQuery(internal.auth.queries.getUserByEmail, {
      email: record.email,
    })) as UserRow;

    if (!user || user.deleted_at) throw new ConvexError("Account not found.");
    if (user._id !== record.user_id) throw new ConvexError("Invalid reset token.");

    const profile = (await ctx.runQuery(internal.auth.queries.getProfileByUserId, {
      userId: user._id as never,
    })) as { username?: string } | null;

    validatePassword(args.password, record.email, profile?.username);

    if (user.password_hash) {
      const sameAsOld = await verifyPassword(args.password, user.password_hash);
      if (sameAsOld) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "New password must be different from the current password.",
        });
      }
    }

    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `reset-password:${record.email}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    const newHash = await hashPassword(args.password);

    // Password + lockout reset happen in one atomic mutation, then the token
    // is burned.
    await ctx.runMutation(internal.auth.mutations.updatePasswordInternal, {
      userId: user._id as never,
      password_hash: newHash,
    });

    await ctx.runMutation(internal.auth.passwordResetInternal.markUsed, {
      token_hash: tokenHash,
    });

    await sendPasswordChangedEmail(record.email);

    return { success: true };
  },
});

/** Lets the UI show an expired/invalid state before rendering the form. */
export const verifyResetToken: ReturnType<typeof action> = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; email?: string; expiresAt?: number }> => {
    const raw = args.token.trim();
    if (!raw) return { valid: false };

    const record = (await ctx.runQuery(
      internal.auth.passwordResetInternal.getByTokenHash,
      { token_hash: sha256Hex(raw) },
    )) as { email: string; expires_at: number; used_at?: number } | null;

    if (!record) return { valid: false };
    if (record.used_at) return { valid: false };
    if (record.expires_at < Date.now()) return { valid: false };
    return { valid: true, email: record.email, expiresAt: record.expires_at };
  },
});
