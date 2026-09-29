import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

/**
 * Fixed-window rate limiting backed by the `auth_rate_limits` table.
 *
 * Used to bound the cost of unauthenticated, CPU-heavy or email-sending
 * endpoints (bcrypt hashing, verification codes, avatar upload URLs).
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/** Read-only check. Does not consume quota. */
export const checkRateLimit = internalQuery({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, args): Promise<RateLimitResult> => {
    const row = await ctx.db
      .query("auth_rate_limits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    const now = Date.now();
    if (!row || now - row.window_start >= args.windowMs) {
      return { allowed: true, remaining: args.limit, retryAfterSec: 0 };
    }
    const retryAfterSec = Math.ceil((args.windowMs - (now - row.window_start)) / 1000);
    if (row.count >= args.limit) {
      return { allowed: false, remaining: 0, retryAfterSec };
    }
    return { allowed: true, remaining: args.limit - row.count, retryAfterSec };
  },
});

/**
 * Consumes one unit of quota. Throws RATE_LIMITED when the window is
 * exhausted, so callers can surface a uniform error shape.
 */
export const consumeRateLimit = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, args): Promise<RateLimitResult> => {
    const now = Date.now();
    const row = await ctx.db
      .query("auth_rate_limits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!row || now - row.window_start >= args.windowMs) {
      if (row) await ctx.db.delete(row._id);
      await ctx.db.insert("auth_rate_limits", {
        key: args.key,
        window_start: now,
        count: 1,
      });
      return { allowed: true, remaining: args.limit - 1, retryAfterSec: 0 };
    }

    if (row.count >= args.limit) {
      const retryAfterSec = Math.ceil((args.windowMs - (now - row.window_start)) / 1000);
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: `Too many requests. Please wait ${retryAfterSec}s.`,
      });
    }

    await ctx.db.patch(row._id, { count: row.count + 1 });
    return {
      allowed: true,
      remaining: args.limit - row.count - 1,
      retryAfterSec: 0,
    };
  },
});

/** Removes expired windows so the table does not grow without bound. */
export const sweepRateLimits = internalMutation({
  args: { olderThanMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMs;
    const stale = await ctx.db
      .query("auth_rate_limits")
      .withIndex("by_key")
      .collect();
    let removed = 0;
    for (const row of stale) {
      if (row.window_start < cutoff) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    return { removed };
  },
});
