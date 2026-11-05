import { mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { requireSpaceIcon } from "./iconMedia";
import { authorize } from "../lists/access";
export const set = mutation({
  args: { ticket: v.string(), key: v.string() },
  handler: async (ctx, a) => {
    const auth = await authorize(ctx, a.ticket);
    if (!auth) throw new ConvexError({ code: "UNAUTHORIZED" });
    const i = await requireSpaceIcon(ctx, auth.space._id, a.key);
    await ctx.db.patch(auth.space._id, {
      edited_at: Date.now(),
      icon: `media:${auth.space.slug}:${i.key}`,
    });
  },
});
