"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { issueClaimGrant, sha256Hex } from "./crypto";
import { validateEmail } from "./validators";

export const createSession = action({
  args: { email: v.string(), claim: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    token: string;
    claim: string;
    email: string;
    expiresAt: number;
    locale?: string;
  }> => {
    const token = issueClaimGrant();
    const claim = issueClaimGrant();
    const result = await ctx.runMutation(internal.auth.sessionStore.create, {
      email: validateEmail(args.email),
      claim_hash: sha256Hex(args.claim),
      token_hash: sha256Hex(token),
      next_claim_hash: sha256Hex(claim),
    });
    return { ...result, token, claim };
  },
});

export const resumeSession = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ email: string; claim: string } | null> => {
    if (args.token.length < 32 || args.token.length > 256) return null;
    const claim = issueClaimGrant();
    const result = await ctx.runMutation(internal.auth.sessionStore.resume, {
      token_hash: sha256Hex(args.token),
      claim_hash: sha256Hex(claim),
    });
    return result ? { email: result.email, claim } : null;
  },
});

export const revokeSession = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.auth.sessionStore.revoke, {
      token_hash: sha256Hex(args.token),
    });
    return { success: true };
  },
});
