import { query, mutation, internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { authorize, digest } from "../lists/access";
import { noteFields, validateNote, notePreview } from "./model";
function fail(code: string): never {
  throw new ConvexError({ code });
}
export const watch = query({
  args: { ticket: v.string(), selectedKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth)
      return {
        status: "expired" as const,
        owner: "",
        notes: [],
        note: null,
        history: [],
      };
    const catalog = await ctx.db
      .query("note_catalog")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .collect();
    const selected = catalog.find((n) => n.key === args.selectedKey);
    const note = selected ? await ctx.db.get(selected.note_id) : null;
    const history = note
      ? await ctx.db
          .query("note_versions")
          .withIndex("by_note", (q) => q.eq("note_id", note._id))
          .collect()
      : [];
    return {
      status: "ready" as const,
      owner: String(auth.user._id),
      notes: catalog.map(
        ({ _id, _creationTime, space_id, note_id, ...item }) => item,
      ),
      note: note
        ? {
            key: note.key,
            title: note.title,
            body: note.body,
            icon: note.icon,
            color: note.color,
            tags: note.tags,
            pinned: note.pinned,
            archived: note.archived,
            trashed: note.trashed,
            revision: note.revision,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            pageId: note.pageId ? String(note.pageId) : undefined,
          }
        : null,
      history: history
        .map(({ _id, revision, createdAt, title }) => ({
          id: _id,
          revision,
          createdAt,
          title,
        }))
        .sort((a, b) => b.revision - a.revision),
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
      v.literal("save"),
      v.literal("delete"),
      v.literal("duplicate"),
      v.literal("promote"),
      v.literal("restoreVersion"),
    ),
    revision: v.optional(v.number()),
    fields: v.optional(v.object(noteFields)),
    newKey: v.optional(v.string()),
    versionId: v.optional(v.id("note_versions")),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    if (!/^[\w-]{8,100}$/.test(args.opId) || !/^[\w-]{8,100}$/.test(args.key))
      fail("VALIDATION_ERROR");
    const hash = await digest(
      JSON.stringify({ ...args, ticket: undefined, opId: undefined }),
    );
    const receipt = await ctx.db
      .query("note_operations")
      .withIndex("by_space_op", (q) =>
        q.eq("space_id", auth.space._id).eq("op_id", args.opId),
      )
      .first();
    if (receipt) {
      if (hash !== receipt.hash) fail("VALIDATION_ERROR");
      return { ok: true, key: receipt.resultKey, pageId: receipt.pageId };
    }
    const previous = await ctx.db
      .query("space_notes")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", args.key),
      )
      .first();
    if (
      args.kind !== "create" &&
      (!previous || previous.revision !== args.revision)
    )
      fail(previous ? "CONFLICT" : "NOT_FOUND");
    let resultKey = args.key,
      pageId = previous?.pageId;
    const now = Date.now();
    if (args.kind === "delete") {
      if (!previous!.trashed) fail("TRASH_REQUIRED");
      for (const row of await ctx.db
        .query("note_versions")
        .withIndex("by_note", (q) => q.eq("note_id", previous!._id))
        .collect())
        await ctx.db.delete(row._id);
      const catalog = await ctx.db
        .query("note_catalog")
        .withIndex("by_note", (q) => q.eq("note_id", previous!._id))
        .first();
      if (catalog) await ctx.db.delete(catalog._id);
      await ctx.db.delete(previous!._id);
    } else if (args.kind === "promote") {
      if (previous!.trashed || previous!.archived) fail("READ_ONLY");
      if (pageId && !(await ctx.db.get(pageId))) pageId = undefined;
      if (!pageId) {
        if (
          (
            await ctx.db
              .query("space_pages")
              .withIndex("by_space_id", (q) => q.eq("space_id", auth.space._id))
              .take(200)
          ).length >= 200
        )
          fail("LIMIT_REACHED");
        pageId = await ctx.db.insert("space_pages", {
          space_id: auth.space._id,
          title: previous!.title,
          body: previous!.body,
          icon: previous!.icon,
          revision: 1,
          created_at: now,
          updated_at: now,
          is_starter: false,
        });
        await ctx.db.patch(previous!._id, { pageId });
        const cat = await ctx.db
          .query("note_catalog")
          .withIndex("by_note", (q) => q.eq("note_id", previous!._id))
          .first();
        if (cat) await ctx.db.patch(cat._id, { pageId });
      }
    } else {
      let fields = args.fields;
      if (args.kind === "duplicate") {
        if (!args.newKey || !/^[\w-]{8,100}$/.test(args.newKey))
          fail("VALIDATION_ERROR");
        resultKey = args.newKey;
        fields = {
          title: previous!.title,
          body: previous!.body,
          icon: previous!.icon,
          color: previous!.color,
          tags: previous!.tags,
          pinned: false,
          archived: false,
          trashed: false,
        };
      }
      if (args.kind === "restoreVersion") {
        if (previous!.archived || previous!.trashed) fail("READ_ONLY");
        const version = args.versionId
          ? await ctx.db.get(args.versionId)
          : null;
        if (!version || version.note_id !== previous!._id) fail("NOT_FOUND");
        fields = {
          title: version.title,
          body: version.body,
          icon: version.icon,
          color: version.color,
          tags: version.tags,
          pinned: previous!.pinned,
          archived: previous!.archived,
          trashed: previous!.trashed,
        };
      }
      if (!fields) fail("VALIDATION_ERROR");
      try {
        fields = validateNote(fields!);
      } catch {
        fail("VALIDATION_ERROR");
      }
      if (
        previous &&
        args.kind === "save" &&
        (previous.archived || previous.trashed) &&
        (fields!.title !== previous.title ||
          fields!.body !== previous.body ||
          fields!.icon !== previous.icon ||
          fields!.color !== previous.color ||
          JSON.stringify(fields!.tags) !== JSON.stringify(previous.tags))
      )
        fail("READ_ONLY");
      if (fields!.archived || fields!.trashed)
        fields = { ...fields!, pinned: false };
      if (args.kind === "create" || args.kind === "duplicate") {
        if (
          (
            await ctx.db
              .query("note_catalog")
              .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
              .take(500)
          ).length >= 500
        )
          fail("LIMIT_REACHED");
        const exists = await ctx.db
          .query("space_notes")
          .withIndex("by_space_key", (q) =>
            q.eq("space_id", auth.space._id).eq("key", resultKey),
          )
          .first();
        if (exists) fail("CONFLICT");
        const id = await ctx.db.insert("space_notes", {
          ...fields!,
          space_id: auth.space._id,
          key: resultKey,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        const { body, ...meta } = fields!;
        await ctx.db.insert("note_catalog", {
          ...meta,
          space_id: auth.space._id,
          note_id: id,
          key: resultKey,
          preview: notePreview(body),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const old = previous!;
        await ctx.db.insert("note_versions", {
          note_id: old._id,
          title: old.title,
          body: old.body,
          icon: old.icon,
          color: old.color,
          tags: old.tags,
          revision: old.revision,
          createdAt: now,
        });
        const versions = await ctx.db
          .query("note_versions")
          .withIndex("by_note", (q) => q.eq("note_id", old._id))
          .collect();
        for (const version of versions
          .sort((a, b) => b.revision - a.revision)
          .slice(10))
          await ctx.db.delete(version._id);
        await ctx.db.patch(old._id, {
          ...fields!,
          revision: old.revision + 1,
          updatedAt: now,
        });
        const cat = await ctx.db
          .query("note_catalog")
          .withIndex("by_note", (q) => q.eq("note_id", old._id))
          .first();
        const { body, ...meta } = fields!;
        if (cat)
          await ctx.db.patch(cat._id, {
            ...meta,
            preview: notePreview(body),
            revision: old.revision + 1,
            updatedAt: now,
          });
      }
    }
    await ctx.db.insert("note_operations", {
      space_id: auth.space._id,
      op_id: args.opId,
      hash,
      resultKey,
      pageId,
      createdAt: now,
    });
    return { ok: true, key: resultKey, pageId };
  },
});
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("note_operations")
      .withIndex("by_created", (q) =>
        q.lt("createdAt", Date.now() - 7 * 86400000),
      )
      .take(1000))
      await ctx.db.delete(row._id);
  },
});
