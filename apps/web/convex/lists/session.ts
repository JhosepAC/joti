"use node";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { issueClaimGrant, sha256Hex } from "../auth/crypto";
import { validateSlug } from "../spaces/validators";
export const connect = action({
  args: { token: v.string(), slug: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ticket: string; expiresAt: number }> => {
    const ticket = issueClaimGrant();
    const result = await ctx.runMutation(internal.lists.access.mint, {
      session_hash: sha256Hex(args.token),
      ticket_hash: sha256Hex(ticket),
      slug: validateSlug(args.slug),
    });
    return { ...result, ticket };
  },
});
