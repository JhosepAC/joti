"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { internal } from "../_generated/api";
import { api } from "../_generated/api";
import { BCRYPT_COST } from "./constants";
import { validateEmail, validatePassword } from "./validators";

const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const RESEND_FROM = process.env.RESEND_FROM ?? "Joti <onboarding@resend.dev>";

function sha256Hex(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateSecureToken(): string {
  // 32 bytes -> 43 chars base64url
  return crypto.randomBytes(32).toString("base64url");
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM,
          reply_to: "jhosepjamil@gmail.com",
          to: [to],
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.warn(`[Email][Resend] failed ${res.status}: ${body}`);
        console.log(`[Email] mock -> To: ${to} | Subject: ${subject}`);
      }
    } catch (e) {
      console.warn("[Email][Resend] exception", e);
      console.log(`[Email] mock -> To: ${to} | Subject: ${subject}`);
    }
  } else {
    console.log(`[Email] From: jhosepjamil@gmail.com -> To: ${to} | Subject: ${subject} | HTML: ${html}`);
  }
}

/**
 * Request password reset — always returns success to prevent user enumeration.
 * If email exists (and not soft-deleted), creates hashed token and sends link.
 */
export const requestPasswordReset: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const cleanEmail = validateEmail(args.email);

    const user = (await ctx.runQuery(api.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as { _id: string; email: string; password_hash?: string; deleted_at?: number } | null;

    // Always return success to avoid enumeration. Only send if account is real and has password.
    if (!user || user.deleted_at) {
      console.log(`[PasswordReset] request for non-existing email ${cleanEmail} — returning generic success`);
      return { sent: true };
    }

    // OAuth-only accounts without password: still send generic email directing to Google sign-in?
    // We send but reset will fail gracefully; better to send informational email.
    if (!user.password_hash) {
      await sendEmail(
        cleanEmail,
        "Password reset request",
        `<p>You requested a password reset for <strong>${cleanEmail}</strong>, but this account uses Google sign-in. Please continue with Google.</p>`,
        `You requested a password reset but this account uses Google sign-in. Please continue with Google.`,
      );
      return { sent: true };
    }

    const rawToken = generateSecureToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = Date.now() + RESET_EXPIRY_MS;

    await ctx.runMutation(internal.auth.passwordResetInternal.createResetToken, {
      user_id: user._id as never,
      email: cleanEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const resetLink = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
    const html = `
      <p>You requested to reset your password for <strong>${cleanEmail}</strong>.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;">Reset your password</a></p>
      <p>This link expires in 60 minutes. If you did not request this, ignore this email.</p>
      <p style="color:#666;font-size:12px;word-break:break-all;">Or copy: ${resetLink}</p>
    `;
    await sendEmail(
      cleanEmail,
      "Reset your Joti password",
      html,
      `Reset your password: ${resetLink} (expires in 60 minutes)`,
    );

    return { sent: true };
  },
});

/**
 * Reset password via token — validates token, enforces password policy, updates hash,
 * invalidates token, resets lockout, and sends confirmation email.
 */
export const resetPassword: ReturnType<typeof action> = action({
  args: { token: v.string(), password: v.string(), confirmPassword: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const rawToken = args.token.trim();
    if (!rawToken) throw new ConvexError({ code: "VALIDATION_ERROR", message: "Reset token is required." });

    if (args.confirmPassword !== undefined && args.password !== args.confirmPassword) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Passwords do not match." });
    }

    const tokenHash = sha256Hex(rawToken);

    const record = (await ctx.runQuery(internal.auth.passwordResetInternal.getByTokenHash, {
      token_hash: tokenHash,
    })) as
      | { _id: string; user_id: string; email: string; expires_at: number; used_at?: number }
      | null;

    if (!record) throw new ConvexError({ code: "VALIDATION_ERROR", message: "Invalid or expired reset link." });
    if (record.used_at) throw new ConvexError({ code: "VALIDATION_ERROR", message: "This reset link has already been used." });
    if (record.expires_at < Date.now()) throw new ConvexError({ code: "VALIDATION_ERROR", message: "Reset link has expired. Please request a new one." });

    const user = (await ctx.runQuery(api.auth.queries.getUserByEmail, {
      email: record.email,
    })) as
      | { _id: string; email: string; password_hash?: string; deleted_at?: number }
      | null;
    if (!user || user.deleted_at) throw new ConvexError("Account not found.");
    if (user._id !== record.user_id) throw new ConvexError("Invalid reset token.");

    // Fetch profile to get username for password validation (prevent containing username)
    const profile = (await ctx.runQuery(api.auth.queries.getProfileByUserId, {
      userId: user._id as never,
    })) as { username?: string } | null;
    const username = profile?.username;

    // Enforce same password policy as registration (database/auth.md)
    validatePassword(args.password, record.email, username);

    // Prevent reusing same password
    if (user.password_hash) {
      const sameAsOld = await bcrypt.compare(args.password, user.password_hash);
      if (sameAsOld) throw new ConvexError({ code: "VALIDATION_ERROR", message: "New password must be different from the current password." });
    }

    const salt = await bcrypt.genSalt(BCRYPT_COST);
    const newHash = await bcrypt.hash(args.password, salt);

    // Update password + reset lockout atomically via internal mutation
    await ctx.runMutation(internal.auth.mutations.updatePasswordInternal, {
      userId: user._id as never,
      password_hash: newHash,
    });

    await ctx.runMutation(internal.auth.passwordResetInternal.markUsed, {
      token_hash: tokenHash,
    });

    // Confirmation email
    await sendEmail(
      record.email,
      "Your Joti password was changed",
      `<p>Your password for <strong>${record.email}</strong> was successfully changed.</p><p>If you did not make this change, please contact support immediately and reset your password again.</p>`,
      `Your Joti password was successfully changed. If you didn't do this, reset again immediately.`,
    );

    return { success: true };
  },
});

/**
 * Verify token validity (for UI to show expired/invalid state before form).
 */
export const verifyResetToken: ReturnType<typeof action> = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ valid: boolean; email?: string; expiresAt?: number }> => {
    const raw = args.token.trim();
    if (!raw) return { valid: false };
    const hash = sha256Hex(raw);
    const record = (await ctx.runQuery(internal.auth.passwordResetInternal.getByTokenHash, {
      token_hash: hash,
    })) as { email: string; expires_at: number; used_at?: number } | null;
    if (!record) return { valid: false };
    if (record.used_at) return { valid: false };
    if (record.expires_at < Date.now()) return { valid: false };
    return { valid: true, email: record.email, expiresAt: record.expires_at };
  },
});
