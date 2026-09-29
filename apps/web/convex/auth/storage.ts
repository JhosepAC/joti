"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { validateEmail } from "./validators";
import { sha256Hex } from "./crypto";

// ---------------------------------------------------------------------------
// Avatar upload URLs.
//
// The public entry point. It only hashes the claim grant and delegates; the
// authorization decision and the actual `ctx.storage.generateUploadUrl()` call
// live in `storageInternal.mintAvatarUploadUrl`, because Convex storage is only
// reachable from the mutation runtime while hashing needs Node.
//
// Previously this was a mutation with `args: {}`, no auth and no rate limit, so
// anyone on the internet could mint unlimited upload URLs and run up the
// project's storage bill. It now requires a claim grant -- a short-lived token
// issued only after a successful password check or email-code redemption.
// ---------------------------------------------------------------------------

export const generateAvatarUploadUrl: ReturnType<typeof action> = action({
  args: { email: v.string(), claim: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);

    return (await ctx.runMutation(internal.auth.storageInternal.mintAvatarUploadUrl, {
      email: cleanEmail,
      claim_hash: sha256Hex(args.claim),
    })) as string;
  },
});
