"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { api } from "../_generated/api";
import { validateEmail } from "./validators";

// 10 min expiry, 5 max attempts
const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Request verification code — stores code and mocks email send via jhosepjamil@gmail.com
 * In production, replace console.log with Resend/Nodemailer using SMTP.
 */
export const requestEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; expiresAt: number }> => {
    const cleanEmail = validateEmail(args.email);

    // Block only if already fully verified (active account)
    const existing = (await ctx.runQuery(api.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as { email_verified_at?: number } | null;
    if (existing?.email_verified_at) throw new ConvexError("Email is already registered.");

    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    await ctx.runMutation(internal.auth.verificationInternal.upsertCode, {
      email: cleanEmail,
      code,
      expires_at: expiresAt,
    });

    // Dispatch email via Resend if configured, otherwise mock log
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "Joti <onboarding@resend.dev>",
            reply_to: "jhosepjamil@gmail.com",
            to: [cleanEmail],
            subject: "Your Joti verification code",
            html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p><p>If you did not request this, ignore this email.</p>`,
            text: `Your Joti verification code is ${code}. It expires in 10 minutes.`,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.warn(`[Email][Resend] failed ${res.status}: ${body} — falling back to log`);
          console.log(`[Email] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code}`);
        }
      } catch (e) {
        console.warn("[Email][Resend] exception", e);
        console.log(`[Email] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code}`);
      }
    } else {
      console.log(
        `[Email] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code} | Expires: ${new Date(expiresAt).toISOString()}`,
      );
    }

    return { sent: true, expiresAt };
  },
});

export const confirmEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ verified: boolean }> => {
    const cleanEmail = validateEmail(args.email);
    const cleanCode = args.code.trim();

    if (!/^\d{6}$/.test(cleanCode)) throw new ConvexError("Code must be 6 digits.");

    const result: { verified: boolean } = await ctx.runMutation(
      internal.auth.verificationInternal.verifyCode,
      {
        email: cleanEmail,
        code: cleanCode,
      },
    );

    if (!result.verified) throw new ConvexError("Invalid or expired code.");

    // Activate pending account (set email_verified_at)
    await ctx.runMutation(internal.auth.mutations.activateUser, { email: cleanEmail });

    return { verified: true };
  },
});

export const resendEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; expiresAt: number }> => {
    const cleanEmail = validateEmail(args.email);
    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    await ctx.runMutation(internal.auth.verificationInternal.upsertCode, {
      email: cleanEmail,
      code,
      expires_at: expiresAt,
    });

    const resendKey2 = process.env.RESEND_API_KEY;
    if (resendKey2) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey2}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM ?? "Joti <onboarding@resend.dev>",
            reply_to: "jhosepjamil@gmail.com",
            to: [cleanEmail],
            subject: "Your Joti verification code (resend)",
            html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
            text: `Your Joti verification code is ${code}. It expires in 10 minutes.`,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.warn(`[Email][Resend] failed ${res.status}: ${body}`);
          console.log(`[Email][Resend] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code}`);
        }
      } catch (e) {
        console.warn("[Email][Resend] exception", e);
        console.log(`[Email][Resend] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code}`);
      }
    } else {
      console.log(`[Email][Resend] From: jhosepjamil@gmail.com -> To: ${cleanEmail} | Code: ${code}`);
    }

    return { sent: true, expiresAt };
  },
});

// Helper query to check if email is already verified (for login gate)
export const isEmailVerified: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const cleanEmail = validateEmail(args.email);
    const record = (await ctx.runQuery(internal.auth.verificationInternal.getByEmail, {
      email: cleanEmail,
    })) as { verified_at?: number } | null;
    return Boolean(record?.verified_at);
  },
});
