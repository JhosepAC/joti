import { internalMutation } from "../_generated/server";
import { ConvexError } from "convex/values";

/** Atomic shared Gmail budget across purposes and concurrent Node workers. */
export const consume = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const [key, limit, windowMs] of [
      ["gmail:day", 200, 86400000],
      ["gmail:minute", 10, 60000],
    ] as const) {
      const row = await ctx.db
        .query("auth_rate_limits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (row && now - row.window_start < windowMs) {
        if (row.count >= limit) throw new ConvexError({ code: "RATE_LIMITED" });
        await ctx.db.patch(row._id, { count: row.count + 1 });
      } else if (row)
        await ctx.db.patch(row._id, { count: 1, window_start: now });
      else
        await ctx.db.insert("auth_rate_limits", {
          key,
          count: 1,
          window_start: now,
        });
    }
  },
});
