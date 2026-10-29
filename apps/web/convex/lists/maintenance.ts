import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
/** One-time upgrade for tables created before the lightweight realtime catalog existed. */
export const backfillCatalog = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("space_lists")
      .paginate({ numItems: 10, cursor });
    for (const list of page.page) {
      const existing = await ctx.db
        .query("list_catalog")
        .withIndex("by_list", (q) => q.eq("list_id", list._id))
        .first();
      if (!existing)
        await ctx.db.insert("list_catalog", {
          space_id: list.space_id,
          list_id: list._id,
          key: list.key,
          name: list.name,
          icon: list.icon,
          archived: list.archived,
          revision: list.revision,
        });
    }
    return { done: page.isDone, cursor: page.continueCursor };
  },
});
