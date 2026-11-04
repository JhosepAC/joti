"use node";

/**
 * Shared verification-code issuance.
 *
 * Lives in a `_`-prefixed file so it is excluded from the Convex public API --
 * it is a plain helper, not a callable function. Both the public
 * `verification.requestEmailCode` action and the wizard's `registerPending`
 * action use it, so there is exactly one place where a code is generated,
 * stored, throttled and emailed.
 *
 * SECURITY: the cleartext code exists only inside `issueVerificationCode`; it
 * is hashed before it reaches the database and is never logged.
 */

import crypto from "node:crypto";
import { ConvexError } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { validateEmail } from "./validators";
import { hashEmailCode } from "./crypto";
import { sendVerificationCodeEmail } from "./email";
import { resolveEmailLocale } from "./emailCopy";
import {
  VERIFICATION_CODE_COOLDOWN_MS,
  VERIFICATION_CODE_EXPIRY_MS,
  VERIFICATION_MAX_PER_HOUR,
} from "./constants";

const HOUR_MS = 60 * 60 * 1000;

/** Cryptographically secure 6-digit code. */
function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

type Ctx = GenericActionCtx<DataModel>;

/**
 * Issues (or re-issues) a verification code and emails it.
 *
 * Returns the same shape for every address, so this cannot be used to discover
 * which addresses are registered. Abuse of the send path is bounded by the
 * per-address cooldown and hourly cap.
 */
export async function issueVerificationCode(
  ctx: Ctx,
  rawEmail: string,
  rawLocale?: string,
): Promise<{ expiresAt: number }> {
  const email = validateEmail(rawEmail);
  const locale = resolveEmailLocale(rawLocale);

  // Cooldown first, then the hourly cap, so a burst cannot fan out into
  // hundreds of provider calls.
  const recent = (await ctx.runQuery(
    internal.auth.verificationInternal.getByEmail,
    {
      email,
    },
  )) as { expires_at: number } | null;

  if (recent) {
    const sentAt = recent.expires_at - VERIFICATION_CODE_EXPIRY_MS;
    const elapsed = Date.now() - sentAt;
    if (elapsed >= 0 && elapsed < VERIFICATION_CODE_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (VERIFICATION_CODE_COOLDOWN_MS - elapsed) / 1000,
      );
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: `Please wait ${waitSec}s before requesting another code.`,
      });
    }
  }

  await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
    key: `verify-email:${email}`,
    limit: VERIFICATION_MAX_PER_HOUR,
    windowMs: HOUR_MS,
  });

  const code = generateCode();
  const expiresAt = Date.now() + VERIFICATION_CODE_EXPIRY_MS;

  const codeHash = hashEmailCode(code);
  await ctx.runMutation(internal.auth.verificationInternal.upsertCode, {
    email,
    code_hash: codeHash,
    enforceCooldown: true,
    expires_at: expiresAt,
  });

  const delivery = await sendVerificationCodeEmail(ctx, email, code, locale);
  if (!delivery.delivered) {
    // Roll back the row so a later retry (once the provider is fixed) starts
    // clean instead of tripping over this attempt's cooldown. The hourly send
    // cap is deliberately NOT refunded: it bounds how fast anyone can make us
    // hit the provider, working or not.
    await ctx.runMutation(internal.auth.verificationInternal.clearByEmail, {
      email,
      code_hash: codeHash,
    });
    throw new ConvexError({
      code: "EMAIL_DELIVERY_FAILED",
      message:
        "We could not send the verification email. Please try again later.",
    });
  }

  return { expiresAt };
}
