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
import { sha256Hex } from "./crypto";
import { sendVerificationCodeEmail } from "./email";
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
): Promise<{ expiresAt: number }> {
  const email = validateEmail(rawEmail);

  // Cooldown first, then the hourly cap, so a burst cannot fan out into
  // hundreds of provider calls.
  const recent = (await ctx.runQuery(internal.auth.verificationInternal.getByEmail, {
    email,
  })) as { expires_at: number } | null;

  if (recent) {
    const sentAt = recent.expires_at - VERIFICATION_CODE_EXPIRY_MS;
    const elapsed = Date.now() - sentAt;
    if (elapsed >= 0 && elapsed < VERIFICATION_CODE_COOLDOWN_MS) {
      const waitSec = Math.ceil((VERIFICATION_CODE_COOLDOWN_MS - elapsed) / 1000);
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

  await ctx.runMutation(internal.auth.verificationInternal.upsertCode, {
    email,
    code_hash: sha256Hex(code),
    expires_at: expiresAt,
  });

  await sendVerificationCodeEmail(email, code);

  return { expiresAt };
}
