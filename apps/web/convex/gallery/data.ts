import { query, mutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { authorize } from "../lists/access";
import {
  cleanTags,
  DEFAULT_PREFERENCES,
  fail,
  preferenceFields,
  validPreferences,
} from "./model";
import { internal } from "../_generated/api";

export const overview = query({
  args: { ticket: v.string() },
  handler: async (ctx, { ticket }) => {
    const auth = await authorize(ctx, ticket);
    if (!auth)
      return {
        status: "expired" as const,
        albums: [],
        tags: [],
        preferences: DEFAULT_PREFERENCES,
        count: 0,
        bytes: 0,
      };
    const albums = await ctx.db
      .query("gallery_albums")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .collect();
    const p = await ctx.db
      .query("gallery_preferences")
      .withIndex("by_space_user", (q) =>
        q.eq("space_id", auth.space._id).eq("user_id", auth.user._id),
      )
      .first();
    const usage = await ctx.db
      .query("gallery_usage")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .first();
    return {
      status: "ready" as const,
      tags: usage?.tags ?? [],
      albums: albums.map(({ _id, name, description, color }) => ({
        id: _id,
        name,
        description,
        color,
      })),
      preferences: p
        ? {
            view: p.view,
            size: p.size,
            density: p.density,
            sort: p.sort,
            direction: p.direction,
            info: p.info,
            group: p.group,
          }
        : DEFAULT_PREFERENCES,
      count: usage?.count ?? 0,
      bytes: usage?.bytes ?? 0,
    };
  },
});
export const createTag = mutation({
  args: { ticket: v.string(), name: v.string() },
  handler: async (ctx, { ticket, name }) => {
    const auth = await authorize(ctx, ticket);
    if (!auth) fail("UNAUTHORIZED");
    if (name.length > 382) fail("VALIDATION_ERROR");
    const additions = cleanTags(
      name
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    if (!additions.length) fail("VALIDATION_ERROR");
    const usage = await ctx.db
      .query("gallery_usage")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .first();
    const tags = [...new Set([...(usage?.tags ?? []), ...additions])];
    if (tags.length > 200) fail("LIMIT_REACHED");
    if (usage) await ctx.db.patch(usage._id, { tags });
    else
      await ctx.db.insert("gallery_usage", {
        space_id: auth.space._id,
        count: 0,
        bytes: 0,
        tags,
      });
    return additions;
  },
});
export const detail = query({
  args: { ticket: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) return null;
    const i = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", args.key),
      )
      .first();
    if (!i) return null;
    const {
      original: _o,
      high: _h,
      medium: _m,
      thumb: _t,
      placeholder: _p,
      hash: _hash,
      attempt: _a,
      space_id: _s,
      user_id: _u,
      _creationTime: _c,
      _id: _i,
      ...image
    } = i;
    return image;
  },
});
export const browse = query({
  args: {
    ticket: v.string(),
    paginationOpts: paginationOptsValidator,
    sort: v.string(),
    direction: v.string(),
    search: v.string(),
    album: v.string(),
    tag: v.string(),
    mime: v.string(),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) return { page: [], isDone: true, continueCursor: "" };
    if (
      args.search.length > 120 ||
      args.tag.length > 30 ||
      args.paginationOpts.numItems > 120
    )
      fail("VALIDATION_ERROR");
    const index =
      args.sort === "captured"
        ? "by_space_captured"
        : args.sort === "name"
          ? "by_space_name"
          : args.sort === "manual"
            ? "by_space_position"
            : "by_space_uploaded";
    const result = await ctx.db
      .query("gallery_images")
      .withIndex(index, (q) => q.eq("space_id", auth.space._id))
      .order(args.direction === "asc" ? "asc" : "desc")
      .paginate(args.paginationOpts);
    const term = args.search.trim().toLocaleLowerCase();
    // Bounded indexed pages: filter within each page rather than loading the whole collection.
    return {
      ...result,
      page: result.page
        .filter(
          (i) =>
            (!term ||
              `${i.title} ${i.filename} ${i.description} ${i.tags.join(" ")}`
                .toLocaleLowerCase()
                .includes(term)) &&
            (!args.album ||
              i.albumIds.some((id) => String(id) === args.album)) &&
            (!args.tag || i.tags.includes(args.tag.toLocaleLowerCase())) &&
            (!args.mime || i.mime === args.mime) &&
            (args.from === undefined || i.capturedAt >= args.from) &&
            (args.to === undefined || i.capturedAt < args.to),
        )
        .map(
          ({
            original: _o,
            high: _h,
            medium: _m,
            thumb: _t,
            placeholder: _p,
            hash: _hash,
            attempt: _a,
            space_id: _s,
            user_id: _u,
            _creationTime: _c,
            _id: _i,
            ...image
          }) => image,
        ),
    };
  },
});
export const preferences = mutation({
  args: { ticket: v.string(), value: v.object(preferenceFields) },
  handler: async (ctx, { ticket, value }) => {
    const auth = await authorize(ctx, ticket);
    if (!auth) fail("UNAUTHORIZED");
    validPreferences(value);
    const old = await ctx.db
      .query("gallery_preferences")
      .withIndex("by_space_user", (q) =>
        q.eq("space_id", auth.space._id).eq("user_id", auth.user._id),
      )
      .first();
    if (old) await ctx.db.patch(old._id, value);
    else
      await ctx.db.insert("gallery_preferences", {
        space_id: auth.space._id,
        user_id: auth.user._id,
        ...value,
      });
  },
});
export const album = mutation({
  args: {
    ticket: v.string(),
    id: v.optional(v.id("gallery_albums")),
    kind: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    const old = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && (!old || old.space_id !== auth.space._id)) fail("NOT_FOUND");
    if (args.kind === "delete") {
      if (!old) return;
      // Remove references in bounded scheduled batches; image records/files are retained.
      await ctx.db.delete(old._id);
      await ctx.scheduler.runAfter(0, internal.gallery.store.detachAlbum, {
        spaceId: auth.space._id,
        albumId: old._id,
      });
      return old._id;
    }
    if (
      !["create", "save"].includes(args.kind) ||
      !args.name?.trim() ||
      args.name.length > 80 ||
      (args.description?.length ?? 0) > 1000 ||
      !["gray", "blue", "green", "rose", "amber", "violet"].includes(
        args.color ?? "",
      )
    )
      fail("VALIDATION_ERROR");
    const fields = {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      color: args.color!,
    };
    if (old) {
      await ctx.db.patch(old._id, fields);
      return old._id;
    }
    const albums = await ctx.db
      .query("gallery_albums")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .take(101);
    if (albums.length >= 100) fail("LIMIT_REACHED");
    const same = albums.find(
      (a) => a.name.toLocaleLowerCase() === fields.name.toLocaleLowerCase(),
    );
    if (same) return same._id;
    return await ctx.db.insert("gallery_albums", {
      space_id: auth.space._id,
      ...fields,
      createdAt: Date.now(),
    });
  },
});
export const edit = mutation({
  args: {
    ticket: v.string(),
    key: v.string(),
    revision: v.number(),
    title: v.string(),
    description: v.string(),
    tags: v.array(v.string()),
    albumIds: v.array(v.id("gallery_albums")),
    capturedAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    const image = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", args.key),
      )
      .first();
    if (!image) fail("NOT_FOUND");
    if (
      !args.title.trim() ||
      args.title.length > 160 ||
      args.description.length > 3000 ||
      args.albumIds.length > 100 ||
      (args.capturedAt !== undefined &&
        args.capturedAt !== null &&
        (!Number.isFinite(args.capturedAt) ||
          args.capturedAt < Date.UTC(1800, 0, 1) ||
          args.capturedAt > Date.now() + 86400000))
    )
      fail("VALIDATION_ERROR");
    const tags = cleanTags(args.tags),
      albumIds = [...new Set(args.albumIds)];
    for (const id of albumIds) {
      const a = await ctx.db.get(id);
      if (a?.space_id !== auth.space._id) fail("NOT_FOUND");
    }
    if (image.revision !== args.revision) fail("CONFLICT");
    await ctx.db.patch(image._id, {
      title: args.title.trim(),
      description: args.description.trim(),
      tags,
      albumIds,
      capturedAt:
        args.capturedAt === null
          ? image.uploadedAt
          : (args.capturedAt ?? image.capturedAt),
      hasCaptureDate:
        args.capturedAt === null
          ? false
          : args.capturedAt !== undefined || image.hasCaptureDate,
      ...(args.capturedAt !== undefined ? { captureEdited: true } : {}),
      revision: image.revision + 1,
    });
  },
});
export const bulk = mutation({
  args: {
    ticket: v.string(),
    keys: v.array(v.string()),
    kind: v.string(),
    albumId: v.optional(v.id("gallery_albums")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    if (
      !args.keys.length ||
      args.keys.length > 100 ||
      !["delete", "addAlbum", "removeAlbum", "moveAlbum", "tags"].includes(
        args.kind,
      )
    )
      fail("VALIDATION_ERROR");
    if (args.kind.includes("Album")) {
      const a = args.albumId ? await ctx.db.get(args.albumId) : null;
      if (a?.space_id !== auth.space._id) fail("NOT_FOUND");
    }
    const tags = cleanTags(args.tags ?? []);
    for (const key of new Set(args.keys)) {
      const i = await ctx.db
        .query("gallery_images")
        .withIndex("by_space_key", (q) =>
          q.eq("space_id", auth.space._id).eq("key", key),
        )
        .first();
      if (!i) continue;
      if (args.kind === "delete") {
        const usage = await ctx.db
          .query("gallery_usage")
          .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
          .first();
        if (usage)
          await ctx.db.patch(usage._id, {
            count: Math.max(0, usage.count - 1),
            bytes: Math.max(0, usage.bytes - i.storedBytes),
          });
        for (const id of new Set([
          i.original,
          i.high,
          i.medium,
          i.thumb,
          i.placeholder,
        ]))
          if (id) await ctx.storage.delete(id);
        await ctx.db.delete(i._id);
      } else {
        await ctx.db.patch(i._id, {
          ...(args.kind === "tags"
            ? { tags: cleanTags([...new Set([...i.tags, ...tags])]) }
            : {}),
          ...(args.kind === "addAlbum"
            ? { albumIds: [...new Set([...i.albumIds, args.albumId!])] }
            : {}),
          ...(args.kind === "moveAlbum" ? { albumIds: [args.albumId!] } : {}),
          ...(args.kind === "removeAlbum"
            ? { albumIds: i.albumIds.filter((a) => a !== args.albumId) }
            : {}),
          revision: i.revision + 1,
        });
      }
    }
  },
});
export const move = mutation({
  args: {
    ticket: v.string(),
    key: v.string(),
    beforeKey: v.optional(v.string()),
  },
  handler: async (ctx, { ticket, key, beforeKey }) => {
    const a = await authorize(ctx, ticket);
    if (!a) fail("UNAUTHORIZED");
    const image = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", a.space._id).eq("key", key),
      )
      .first();
    if (!image) fail("NOT_FOUND");
    if (key === beforeKey) return;
    const before = beforeKey
      ? await ctx.db
          .query("gallery_images")
          .withIndex("by_space_key", (q) =>
            q.eq("space_id", a.space._id).eq("key", beforeKey),
          )
          .first()
      : null;
    if (beforeKey && !before) fail("NOT_FOUND");
    const prev = before
      ? await ctx.db
          .query("gallery_images")
          .withIndex("by_space_position", (q) =>
            q.eq("space_id", a.space._id).lt("position", before.position),
          )
          .order("desc")
          .first()
      : await ctx.db
          .query("gallery_images")
          .withIndex("by_space_position", (q) => q.eq("space_id", a.space._id))
          .order("desc")
          .first();
    await ctx.db.patch(image._id, {
      position: before
        ? ((prev?.position ?? before.position - 2048) + before.position) / 2
        : (prev?.position ?? 0) + 1024,
    });
  },
});
