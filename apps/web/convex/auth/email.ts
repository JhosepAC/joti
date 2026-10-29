"use node";

/**
 * Outbound email via Resend.
 *
 * SECURITY: nothing in here ever writes a verification code or a password-reset
 * link to the logs. The previous implementation logged both in cleartext, which
 * meant anyone able to read Convex function logs could complete verification or
 * take over an account.
 */

import {
  passwordChangedCopy,
  passwordResetCopy,
  verificationCopy,
  type EmailLocale,
} from "./emailCopy";

const RESEND_FROM = process.env.RESEND_FROM ?? "Nook <onboarding@resend.dev>";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? "jhosepjamil@gmail.com";

export type EmailResult = { delivered: boolean; reason?: string };

/** Presentation locale for the message body. Contracts stay in English. */
export type { EmailLocale } from "./emailCopy";
export { resolveEmailLocale } from "./emailCopy";

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
    console.error(
      "[email] RESEND_API_KEY is not configured; message not sent.",
    );
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
    console.error(
      "[email] transport error",
      e instanceof Error ? e.message : "unknown",
    );
    return { delivered: false, reason: "transport_error" };
  }
}

export async function sendVerificationCodeEmail(
  to: string,
  code: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const copy = verificationCopy(locale);
  return sendEmail(to, copy.subject, copy.htmlBody(code), copy.textBody(code));
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const copy = passwordResetCopy(locale);
  return sendEmail(
    to,
    copy.subject,
    copy.htmlBody(to, resetLink),
    copy.textBody(to, resetLink),
  );
}

export async function sendPasswordChangedEmail(
  to: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const copy = passwordChangedCopy(locale);
  return sendEmail(to, copy.subject, copy.htmlBody(to), copy.textBody(to));
}
