"use node";

/**
 * Outbound transactional email via Gmail SMTP over verified TLS.
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

// Transport is private: only fixed-purpose helpers below may send messages.
import nodemailer from "nodemailer";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { validateEmail } from "./validators";
import { getAppUrl } from "./appUrl";
type EmailContext = Pick<GenericActionCtx<DataModel>, "runMutation">;
const SENDER = "jhosepjamil@gmail.com";
export type EmailResult = { delivered: boolean; reason?: string };
export type { EmailLocale } from "./emailCopy";
export { resolveEmailLocale } from "./emailCopy";

async function sendEmail(
  ctx: EmailContext,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<EmailResult> {
  // Resolve secrets per invocation so rotation never retains a cached credential.
  const password = (process.env.GMAIL_APP_PASSWORD ?? "").replace(/ /g, "");
  if (!/^[a-zA-Z]{16}$/.test(password))
    return { delivered: false, reason: "not_configured" };
  let recipient: string;
  try {
    recipient = validateEmail(to);
    // A single mailbox only, never a recipient list or header/address expression.
    if (/[\r\n<>,;\s]/.test(recipient))
      return { delivered: false, reason: "invalid_recipient" };
  } catch {
    return { delivered: false, reason: "invalid_recipient" };
  }
  try {
    await ctx.runMutation(internal.auth.emailQuota.consume, {});
  } catch {
    return { delivered: false, reason: "rate_limited" };
  }
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SENDER, pass: password },
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: "smtp.gmail.com",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    pool: false,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    const info = await transport.sendMail({
      from: { name: "Joti", address: SENDER },
      to: { address: recipient, name: "" },
      envelope: { from: SENDER, to: [recipient] },
      replyTo: SENDER,
      subject,
      html,
      text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    // SMTP acceptance is not a guarantee of inbox delivery.
    return info.accepted?.length === 1 && !info.rejected?.length
      ? { delivered: true }
      : { delivered: false, reason: "rejected" };
  } catch {
    // SMTP errors may echo credentials, recipients, or message bodies. Never log them.
    console.error("[email] Gmail SMTP delivery failed");
    return { delivered: false, reason: "transport_error" };
  } finally {
    transport.close();
  }
}

export async function sendVerificationCodeEmail(
  ctx: EmailContext,
  to: string,
  code: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const copy = verificationCopy(locale);
  return sendEmail(
    ctx,
    to,
    copy.subject,
    copy.htmlBody(code),
    copy.textBody(code),
  );
}

export async function sendPasswordResetEmail(
  ctx: EmailContext,
  to: string,
  resetLink: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const target = new URL(resetLink);
  if (
    target.origin !== new URL(getAppUrl()).origin ||
    target.pathname !== "/auth/reset-password" ||
    !target.searchParams.get("token")
  )
    return { delivered: false, reason: "invalid_reset_link" };
  const copy = passwordResetCopy(locale);
  return sendEmail(
    ctx,
    to,
    copy.subject,
    copy.htmlBody(to, resetLink),
    copy.textBody(to, resetLink),
  );
}

export async function sendPasswordChangedEmail(
  ctx: EmailContext,
  to: string,
  locale: EmailLocale = "es",
): Promise<EmailResult> {
  const copy = passwordChangedCopy(locale);
  return sendEmail(ctx, to, copy.subject, copy.htmlBody(to), copy.textBody(to));
}
