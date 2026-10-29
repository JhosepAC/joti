import { query, mutation, internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { authorize, digest } from "../lists/access";
import { validateEvent, validDate } from "./time";
import { eventFields } from "./model";
function fail(code: string): never {
  throw new ConvexError({ code });
}
export const watch = query({
  args: { ticket: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) return { status: "expired" as const, events: [] };
    if (
      !validDate(args.from) ||
      !validDate(args.to) ||
      args.to < args.from ||
      Date.parse(args.to) - Date.parse(args.from) > 63 * 86400000
    )
      fail("VALIDATION_ERROR");
    const rows = await ctx.db
      .query("calendar_events")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .collect();
    // Two-day guard covers every IANA timezone when the viewer differs from the event's zone.
    const lower = Date.parse(args.from) - 2 * 86400000,
      upper = Date.parse(args.to) + 3 * 86400000;
    return {
      status: "ready" as const,
      events: rows
        .filter((e) => e.endsAt > lower && e.startsAt < upper)
        .map(({ _id, _creationTime, space_id, ...event }) => event),
    };
  },
});
export const apply = mutation({
  args: {
    ticket: v.string(),
    opId: v.string(),
    key: v.string(),
    kind: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
    ),
    revision: v.optional(v.number()),
    event: v.optional(v.object(eventFields)),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    if (!/^[\w-]{8,100}$/.test(args.key) || !/^[\w-]{8,100}$/.test(args.opId))
      fail("VALIDATION_ERROR");
    const hash = await digest(
      JSON.stringify({
        kind: args.kind,
        key: args.key,
        revision: args.revision,
        event: args.event,
      }),
    );
    const receipt = await ctx.db
      .query("calendar_operations")
      .withIndex("by_space_op", (q) =>
        q.eq("space_id", auth.space._id).eq("op_id", args.opId),
      )
      .first();
    if (receipt) {
      if (receipt.hash !== hash) fail("VALIDATION_ERROR");
      return { ok: true };
    }
    const previous = await ctx.db
      .query("calendar_events")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", args.key),
      )
      .first();
    if (
      args.kind !== "create" &&
      (!previous || previous.revision !== args.revision)
    )
      fail(previous ? "CONFLICT" : "NOT_FOUND");
    if (args.kind === "delete") {
      await ctx.db.delete(previous!._id);
    } else {
      if (!args.event) fail("VALIDATION_ERROR");
      let validated;
      try {
        validated = validateEvent(args.event!);
      } catch (error) {
        fail(error instanceof Error ? error.message : "VALIDATION_ERROR");
      }
      if (args.kind === "create") {
        if (previous) fail("CONFLICT");
        if (
          (
            await ctx.db
              .query("calendar_events")
              .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
              .take(2000)
          ).length >= 2000
        )
          fail("LIMIT_REACHED");
        await ctx.db.insert("calendar_events", {
          ...validated!,
          space_id: auth.space._id,
          key: args.key,
          revision: 1,
        });
      } else
        await ctx.db.patch(previous!._id, {
          ...validated!,
          revision: previous!.revision + 1,
        });
    }
    await ctx.db.insert("calendar_operations", {
      space_id: auth.space._id,
      op_id: args.opId,
      hash,
      created_at: Date.now(),
    });
    return { ok: true };
  },
});
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("calendar_operations")
      .withIndex("by_created", (q) =>
        q.lt("created_at", Date.now() - 7 * 86400000),
      )
      .take(1000))
      await ctx.db.delete(row._id);
  },
});
