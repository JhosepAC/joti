import { mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { authorize } from "../lists/access";
export const set = mutation({
  args: { ticket: v.string(), key: v.string() },
  handler: async (ctx, a) => {
    const auth = await authorize(ctx, a.ticket);
    if (!auth) throw new ConvexError({ code: "UNAUTHORIZED" });
    const i = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", a.key),
      )
      .first();
    if (
      !i ||
      i.status !== "ready" ||
      i.originalBytes > 128 * 1024 ||
      i.width > 256 ||
      i.height > 256
    )
      throw new ConvexError({ code: "INVALID_IMAGE" });
    await ctx.db.patch(auth.space._id, {
      icon: `media:${auth.space.slug}:${i.key}`,
    });
  },
});
