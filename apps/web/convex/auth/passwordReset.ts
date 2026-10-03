"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import crypto from "node:crypto";
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
import { getAppUrl } from "./appUrl";
import {
  resolveEmailLocale,
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

const HOUR_MS = 60 * 60 * 1000;

const RESET_THROTTLE_MESSAGE = "Too many reset requests. Please try again later.";

/**
 * Per-address reset quota, enforced identically for known and unknown
 * addresses: a 60s cooldown plus 5/hour on the generic limiter. The error is
 * normalized to a single shape so neither the code, the text, nor the timing
 * of the throttle path can distinguish "registered" from "not registered".
 *
 * Per-address limits cannot stop a distributed dictionary scan (that would
 * need a global cap, which is itself a DoS vector); that is inherent here and
 * accepted. What this guarantees is that one address looks the same whether
 * or not it has an account.
 */
async function consumeResetQuota(
  ctx: GenericActionCtx<DataModel>,
  email: string,
): Promise<void> {
  try {
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `reset-request-cooldown:${email}`,
      limit: 1,
      windowMs: PASSWORD_RESET_COOLDOWN_MS,
    });
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `reset-request:${email}`,
      limit: PASSWORD_RESET_MAX_PER_HOUR,
      windowMs: HOUR_MS,
    });
  } catch (err) {
    if (err instanceof ConvexError) {
      throw new ConvexError({ code: "RATE_LIMITED", message: RESET_THROTTLE_MESSAGE });
    }
    throw err;
  }
}

/**
 * Request a password reset.
 *
 * Answers `{ sent: true }` for every address -- unknown ones included -- so
 * the endpoint cannot be used to discover which addresses have accounts, and
 * throttles every address identically (see consumeResetQuota). The raw token
 * is emailed and only its SHA-256 digest is persisted; it is never logged.
 *
 * The one exception is a failed email delivery, which throws
 * EMAIL_DELIVERY_FAILED instead of reporting a success that never happened.
 */
export const requestPasswordReset: ReturnType<typeof action> = action({
  args: { email: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const cleanEmail = validateEmail(args.email);
    // Presentation locale for the email body; unknown values fall back to
    // Spanish, matching the app fallback.
    const locale = resolveEmailLocale(args.locale);

    // Throttle BEFORE the account lookup, identically for both branches (see
    // consumeResetQuota): the check costs the same indexed reads either way,
    // so throttling cannot distinguish "registered" from "not registered".
    await consumeResetQuota(ctx, cleanEmail);

    const user = (await ctx.runQuery(internal.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as UserRow;

    if (!user || user.deleted_at) {
      return { sent: true };
    }

    if (!user.password_hash) {
      const delivery = await sendOAuthOnlyAccountNotice(cleanEmail, locale);
      if (!delivery.delivered) {
        // No row was created on this path, so there is nothing to roll back;
        // surface the failure instead of a fake success (see below).
        throw new ConvexError({
          code: "EMAIL_DELIVERY_FAILED",
          message: "We could not send the email. Please try again later.",
        });
      }
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
    const delivery = await sendPasswordResetEmail(cleanEmail, resetLink, locale);
    if (!delivery.delivered) {
      // Roll back the token row so a retry (once the provider is fixed) mints
      // a fresh link instead of tripping over this attempt. The hourly quota
      // stays consumed on purpose: it bounds how fast anyone can make us hit
      // the provider, working or not.
      await ctx.runMutation(internal.auth.passwordResetInternal.deleteByTokenHash, {
        token_hash: tokenHash,
      });
      throw new ConvexError({
        code: "EMAIL_DELIVERY_FAILED",
        message: "We could not send the reset email. Please try again later.",
      });
    }

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
    locale: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const rawToken = args.token.trim();
    const locale = resolveEmailLocale(args.locale);
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

    await sendPasswordChangedEmail(record.email, locale);

    return { success: true };
  },
});

/** Lets the UI show an expired/invalid state before rendering the form. */
export const verifyResetToken: ReturnType<typeof action> = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; expiresAt?: number }> => {
    const raw = args.token.trim();
    if (!raw) return { valid: false };

    const record = (await ctx.runQuery(
      internal.auth.passwordResetInternal.getByTokenHash,
      { token_hash: sha256Hex(raw) },
    )) as { expires_at: number; used_at?: number } | null;

    if (!record) return { valid: false };
    if (record.used_at) return { valid: false };
    if (record.expires_at < Date.now()) return { valid: false };
    // Deliberately no email: the token is already sufficient for takeover,
    // so echoing the address would only widen history/log exposure. The
    // consuming `resetPassword` resolves the address server-side.
    return { valid: true, expiresAt: record.expires_at };
  },
});
