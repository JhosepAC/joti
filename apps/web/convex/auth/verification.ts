"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { hashEmailCode, hashEmailCodeLegacy, issueClaimGrant, sha256Hex } from "./crypto";
import { CLAIM_SCOPE_ACCOUNT } from "./constants";
import { issueVerificationCode } from "./_codeService";

// `requestEmailCode` and `resendEmailCode` both delegate to
// `_codeService.issueVerificationCode`, which owns generation, throttling,
// hashing and delivery.

export const requestEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { expiresAt } = await issueVerificationCode(ctx, args.email);
    return { sent: true, expiresAt };
  },
});

export const resendEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { expiresAt } = await issueVerificationCode(ctx, args.email);
    return { sent: true, expiresAt };
  },
});

/**
 * Confirms possession of the emailed code.
 *
 * SECURITY: the comparison is a constant-time digest check inside
 * `verificationInternal.verifyCode`, and wrong guesses decrement a per-record
 * attempt counter (5 max) that is only reset when a fresh code is issued. A
 * successful check burns the code, so a captured request cannot be replayed.
 */
export const confirmEmailCode: ReturnType<typeof action> = action({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanCode = args.code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Code must be 6 digits." });
    }

    const result = (await ctx.runMutation(
      internal.auth.verificationInternal.verifyCode,
      {
        email: cleanEmail,
        code: cleanCode,
        code_hash: hashEmailCode(cleanCode),
        // Grace period for rows issued before the pepper existed (they expire
        // within 10 minutes; re-issuance stores only the peppered digest).
        code_hash_legacy: hashEmailCodeLegacy(cleanCode),
      },
    )) as { verified: boolean };

    if (!result.verified) {
      throw new ConvexError("Invalid or expired code.");
    }

    // Redeeming the code is proof of address ownership, so mint the claim grant
    // that the remaining wizard steps (avatar upload, profile submit) require.
    // This replaces what used to be implicit trust in "the caller knows a
    // verified email".
    const claim = issueClaimGrant();

    await ctx.runMutation(internal.auth.claimGrants.issue, {
      email: cleanEmail,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: sha256Hex(claim),
    });

    // Safety net for pre-existing rows that were created without being marked
    // verified. Accounts are now only created after this point, so the lookup
    // usually finds nothing and `activateUser` throws "Account not found." --
    // that is the expected case, not a failure.
    await ctx
      .runMutation(internal.auth.mutations.activateUser, { email: cleanEmail })
      .catch(() => undefined);

    return { verified: true, claim };
  },
});

// isEmailVerified was REMOVED.
//
// It was a public action whose only job was to report whether an address had a
// verification record -- a direct account-existence oracle. Nothing called it.
