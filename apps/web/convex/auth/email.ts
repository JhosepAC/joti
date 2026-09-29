"use node";

/**
 * Outbound email via Resend.
 *
 * SECURITY: nothing in here ever writes a verification code or a password-reset
 * link to the logs. The previous implementation logged both in cleartext, which
 * meant anyone able to read Convex function logs could complete verification or
 * take over an account.
 */

const RESEND_FROM = process.env.RESEND_FROM ?? "Joti <onboarding@resend.dev>";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? "jhosepjamil@gmail.com";

export type EmailResult = { delivered: boolean; reason?: string };

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Fail closed: without a provider we must not pretend the mail went out,
    // and we must not fall back to logging the secret payload.
    console.error("[email] RESEND_API_KEY is not configured; message not sent.");
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        reply_to: REPLY_TO,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      // Log status only -- the response body can echo recipient addresses.
      console.error(`[email] provider returned ${res.status}`);
      return { delivered: false, reason: `provider_${res.status}` };
    }
    return { delivered: true };
  } catch (e) {
    console.error("[email] transport error", e instanceof Error ? e.message : "unknown");
    return { delivered: false, reason: "transport_error" };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function sendVerificationCodeEmail(
  to: string,
  code: string,
): Promise<EmailResult> {
  return sendEmail(
    to,
    "Your Joti verification code",
    `<p>Your verification code is <strong>${escapeHtml(code)}</strong>. It expires in 10 minutes.</p>
     <p>If you did not request this, you can ignore this email.</p>`,
    `Your Joti verification code is ${code}. It expires in 10 minutes.`,
  );
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<EmailResult> {
  const safeLink = escapeHtml(resetLink);
  return sendEmail(
    to,
    "Reset your Joti password",
    `<p>You requested to reset your password for <strong>${escapeHtml(to)}</strong>.</p>
     <p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;">Reset your password</a></p>
     <p>This link expires in 60 minutes and can only be used once. If you did not request this, ignore this email.</p>
     <p style="color:#666;font-size:12px;word-break:break-all;">Or copy: ${safeLink}</p>`,
    `Reset your Joti password (expires in 60 minutes): ${resetLink}`,
  );
}

export async function sendPasswordChangedEmail(to: string): Promise<EmailResult> {
  return sendEmail(
    to,
    "Your Joti password was changed",
    `<p>Your password for <strong>${escapeHtml(to)}</strong> was successfully changed.</p>
     <p>If you did not make this change, reset your password immediately and contact support.</p>`,
    `Your Joti password was changed. If this was not you, reset it immediately.`,
  );
}

export async function sendOAuthOnlyAccountNotice(to: string): Promise<EmailResult> {
  return sendEmail(
    to,
    "Password reset request",
    `<p>You requested a password reset for <strong>${escapeHtml(to)}</strong>, but this account signs in with Google.</p>
     <p>Please continue with Google instead.</p>`,
    `This account signs in with Google. Please continue with Google.`,
  );
}
