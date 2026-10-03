import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { validateEmail } from "./validators";
import { AVATAR_UPLOADS_PER_HOUR, CLAIM_SCOPE_ACCOUNT, MAX_STORAGE_OBJECTS } from "./constants";
import { SESSION_EXPIRED, SESSION_INVALID, burnGrant, findGrantByHash } from "./grantStore";

// ---------------------------------------------------------------------------
// Avatar upload URL minting.
//
// This is an `internalMutation` because Convex storage is only reachable from
// the mutation/query runtime, while hashing the claim grant needs Node. The
// public `storage.generateAvatarUploadUrl` action hashes the token and calls in
// here with the digest.
//
// It was previously `args: {}` with no auth and no rate limit, so anyone on the
// internet could mint unlimited upload URLs and run up the storage bill.
// Binding to an email address alone would not have been enough either:
// addresses are public, so anyone who knew one could mint URLs against it.
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;

export const mintAvatarUploadUrl = internalMutation({
  args: { email: v.string(), claim_hash: v.string() },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);

    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (!user || user.deleted_at) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Cannot upload an avatar for this account.",
      });
    }

    // Validate the claim grant against this address. Lookup and message texts
    // come from the shared grant policy; the structure below preserves the
    // original semantics exactly: a mismatch burns nothing (the presenter
    // does not own that row), while an expired-but-otherwise-valid row is
    // dropped as hygiene. The grant itself is deliberately NOT burned here:
    // the wizard needs it for two steps (this upload, then the profile
    // submit), and `actions.completeProfile` is the terminal step that
    // consumes it. Abuse is bounded by the per-account rate limit below and
    // by the grant's 15 minute lifetime.
    const grant = await findGrantByHash(ctx, args.claim_hash);
    if (!grant || grant.email !== cleanEmail || grant.scope !== CLAIM_SCOPE_ACCOUNT) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: SESSION_INVALID,
      });
    }
    if (grant.expires_at < Date.now()) {
      await burnGrant(ctx, grant._id);
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: SESSION_EXPIRED,
      });
    }

    // Bound how many upload URLs a single account can mint.
    const now = Date.now();
    const limitKey = `avatar-upload:${cleanEmail}`;
    const rl = await ctx.db
      .query("auth_rate_limits")
      .withIndex("by_key", (q) => q.eq("key", limitKey))
      .first();
    if (!rl || now - rl.window_start >= HOUR_MS) {
      if (rl) await ctx.db.delete(rl._id);
      await ctx.db.insert("auth_rate_limits", {
        key: limitKey,
        window_start: now,
        count: 1,
      });
    } else if (rl.count >= AVATAR_UPLOADS_PER_HOUR) {
      const retryAfterSec = Math.ceil((HOUR_MS - (now - rl.window_start)) / 1000);
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: `Too many uploads. Please wait ${retryAfterSec}s.`,
      });
    } else {
      await ctx.db.patch(rl._id, { count: rl.count + 1 });
    }

    // Backstop against distributed abuse across many accounts. Counting every
    // storage object is unbounded work, so page through the system table and
    // stop as soon as the ceiling is reached.
    const capPageSize = 100;
    let stored = 0;
    let cursor: string | null = null;
    for (;;) {
      const page = await ctx.db.system
        .query("_storage")
        .paginate({ cursor, numItems: capPageSize });
      stored += page.page.length;
      if (stored >= MAX_STORAGE_OBJECTS) {
        throw new ConvexError({
          code: "STORAGE_LIMIT",
          message: "Avatar uploads are temporarily unavailable. Please try again later.",
        });
      }
      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return await ctx.storage.generateUploadUrl();
  },
});
