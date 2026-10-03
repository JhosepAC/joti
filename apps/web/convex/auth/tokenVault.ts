"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { encryptToken } from "./crypto";

/**
 * Node-side AES-256-GCM encryption, reachable from the V8 isolate.
 *
 * `oauth/google/callback` is an `httpAction`, so it always runs in the isolate --
 * and the isolate has no `node:crypto`, so it cannot call `encryptToken` itself.
 * An `internalAction` is the only way across that boundary: the isolate calls
 * this, this runs in Node and does the encryption.
 *
 * `internalAction` rather than `action`, so it stays off the public API: a
 * public one would let anyone use this deployment as an encryption oracle, and
 * would also mean an `httpAction` dispatching to a publicly callable function.
 *
 * The token material is passed in and the ciphertext passed straight back; it is
 * never logged here or anywhere else.
 */
export const encryptOAuthTokens = internalAction({
  args: {
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    // `encryptToken` throws when TOKEN_ENCRYPTION_KEY is missing or the wrong
    // length. That is the intended fail-closed behaviour and it propagates to the
    // caller, which turns it into a generic `oauth_failed` redirect.
    return {
      accessTokenEncrypted: args.accessToken ? encryptToken(args.accessToken) : undefined,
      refreshTokenEncrypted: args.refreshToken ? encryptToken(args.refreshToken) : undefined,
    };
  },
});
