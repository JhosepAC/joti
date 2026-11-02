import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { authorize } from "../lists/access";
import { fail, imageVariants, MAX_IMAGES, MAX_SPACE_BYTES } from "./model";
import { internal } from "../_generated/api";
async function consumeProcessing(ctx: MutationCtx, userId: string) {
  const key = `gallery-process:${userId}`,
    now = Date.now();
  const row = await ctx.db
    .query("auth_rate_limits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row && now - row.window_start < 3600000) {
    if (row.count >= 500) fail("RATE_LIMITED");
    await ctx.db.patch(row._id, { count: row.count + 1 });
  } else if (row) await ctx.db.patch(row._id, { window_start: now, count: 1 });
  else
    await ctx.db.insert("auth_rate_limits", {
      key,
      window_start: now,
      count: 1,
    });
}
async function session(
  ctx: QueryCtx | MutationCtx,
  hash: string,
  slug: string,
) {
  const s = await ctx.db
    .query("auth_sessions")
    .withIndex("by_token_hash", (q) => q.eq("token_hash", hash))
    .first();
  if (!s || s.expires_at <= Date.now()) fail("UNAUTHORIZED");
  const u = await ctx.db.get(s.user_id),
    sp = await ctx.db
      .query("spaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  if (
    !u ||
    u.deleted_at ||
    !u.email_verified_at ||
    !sp ||
    sp.deleted_at ||
    sp.owner_id !== u._id
  )
    fail("UNAUTHORIZED");
  return sp;
}
export const media = internalQuery({
  args: {
    hash: v.string(),
    slug: v.string(),
    key: v.string(),
    variant: v.string(),
  },
  handler: async (ctx, args) => {
    const sp = await session(ctx, args.hash, args.slug);
    const i = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", sp._id).eq("key", args.key),
      )
      .first();
    if (!i) fail("NOT_FOUND");
    if (
      !["original", "high", "medium", "thumb", "placeholder"].includes(
        args.variant,
      )
    )
      fail("VALIDATION_ERROR");
    const variant = args.variant as keyof typeof imageVariants;
    const ids = [
      ...new Set(
        [
          i[variant],
          ...(variant !== "original" ? [i.medium, i.thumb] : []),
        ].filter((id): id is NonNullable<typeof id> => !!id),
      ),
    ];
    if (!ids.length) fail("NOT_READY");
    return {
      ids,
      mime: variant === "original" ? i.mime : "image/webp",
      filename: i.filename,
    };
  },
});
export const reserve = internalMutation({
  args: {
    ticket: v.string(),
    key: v.string(),
    hash: v.string(),
    filename: v.string(),
    mime: v.string(),
    bytes: v.number(),
    attempt: v.string(),
    albumId: v.optional(v.id("gallery_albums")),
  },
  handler: async (ctx, args) => {
    const a = await authorize(ctx, args.ticket);
    if (!a) fail("UNAUTHORIZED");
    if (
      !/^[\w-]{8,100}$/.test(args.key) ||
      !args.filename.trim() ||
      args.filename.length > 240
    )
      fail("VALIDATION_ERROR");
    if (args.albumId) {
      const album = await ctx.db.get(args.albumId);
      if (album?.space_id !== a.space._id) fail("NOT_FOUND");
    }
    const sameKey = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", a.space._id).eq("key", args.key),
      )
      .first();
    if (sameKey && sameKey.hash !== args.hash) fail("CONFLICT");
    const old = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_hash", (q) =>
        q.eq("space_id", a.space._id).eq("hash", args.hash),
      )
      .first();
    if (old) {
      if (args.albumId && !old.albumIds.includes(args.albumId))
        await ctx.db.patch(old._id, {
          albumIds: [...old.albumIds, args.albumId],
          revision: old.revision + 1,
        });
      if (old.status === "error" && !old.original) {
        await consumeProcessing(ctx, String(a.user._id));
        await ctx.db.patch(old._id, {
          status: "uploading",
          attempt: args.attempt,
          touchedAt: Date.now(),
          error: undefined,
        });
        return { id: old._id, key: old.key, duplicate: false };
      }
      return { id: old._id, key: old.key, duplicate: true };
    }
    const usage = await ctx.db
      .query("gallery_usage")
      .withIndex("by_space", (q) => q.eq("space_id", a.space._id))
      .first();
    if (
      (usage?.count ?? 0) >= MAX_IMAGES ||
      (usage?.bytes ?? 0) + args.bytes > MAX_SPACE_BYTES
    )
      fail("STORAGE_LIMIT");
    await consumeProcessing(ctx, String(a.user._id));
    const data = {
      count: (usage?.count ?? 0) + 1,
      bytes: (usage?.bytes ?? 0) + args.bytes,
    };
    if (usage) await ctx.db.patch(usage._id, data);
    else
      await ctx.db.insert("gallery_usage", { space_id: a.space._id, ...data });
    const last = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_position", (q) => q.eq("space_id", a.space._id))
      .order("desc")
      .first();
    const id = await ctx.db.insert("gallery_images", {
      space_id: a.space._id,
      user_id: a.user._id,
      key: args.key,
      hash: args.hash,
      filename: args.filename,
      title: (args.filename.replace(/\.[^.]+$/, "") || args.filename).slice(
        0,
        160,
      ),
      description: "",
      tags: [],
      albumIds: args.albumId ? [args.albumId] : [],
      mime: args.mime,
      originalBytes: args.bytes,
      storedBytes: args.bytes,
      width: 1,
      height: 1,
      uploadedAt: Date.now(),
      capturedAt: Date.now(),
      hasCaptureDate: false,
      position: (last?.position ?? 0) + 1024,
      revision: 1,
      status: "uploading",
      attempt: args.attempt,
      touchedAt: Date.now(),
    });
    return { id, key: args.key, duplicate: false };
  },
});
export const attach = internalMutation({
  args: {
    ticket: v.string(),
    id: v.id("gallery_images"),
    attempt: v.string(),
    original: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const a = await authorize(ctx, args.ticket),
      i = await ctx.db.get(args.id);
    if (
      !a ||
      !i ||
      i.space_id !== a.space._id ||
      i.attempt !== args.attempt ||
      i.status !== "uploading"
    )
      fail("UNAUTHORIZED");
    await ctx.db.patch(i._id, {
      original: args.original,
      status: "processing",
      touchedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.gallery.files.process, {
      id: i._id,
      attempt: i.attempt,
    });
  },
});
export const source = internalQuery({
  args: { id: v.id("gallery_images"), attempt: v.string() },
  handler: async (ctx, a) => {
    const i = await ctx.db.get(a.id);
    return i?.attempt === a.attempt && i.status === "processing" ? i : null;
  },
});
export const processed = internalMutation({
  args: {
    id: v.id("gallery_images"),
    attempt: v.string(),
    high: v.id("_storage"),
    medium: v.id("_storage"),
    thumb: v.id("_storage"),
    placeholder: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    bytes: v.number(),
    capturedAt: v.optional(v.number()),
    highWidth: v.number(),
    mediumWidth: v.number(),
    thumbWidth: v.number(),
  },
  handler: async (ctx, { id, attempt, ...fields }) => {
    const i = await ctx.db.get(id);
    if (!i || i.attempt !== attempt || i.status !== "processing") return false;
    const space = await ctx.db.get(i.space_id);
    if (!space || space.deleted_at) return false;
    const usage = await ctx.db
      .query("gallery_usage")
      .withIndex("by_space", (q) => q.eq("space_id", i.space_id))
      .first();
    if (!usage || usage.bytes + fields.bytes > MAX_SPACE_BYTES)
      fail("STORAGE_LIMIT");
    await ctx.db.patch(usage._id, { bytes: usage.bytes + fields.bytes });
    const { bytes, capturedAt, ...rest } = fields;
    await ctx.db.patch(id, {
      ...rest,
      storedBytes: i.storedBytes + bytes,
      capturedAt: i.captureEdited ? i.capturedAt : (capturedAt ?? i.capturedAt),
      hasCaptureDate: i.captureEdited
        ? i.hasCaptureDate
        : capturedAt !== undefined,
      status: "ready",
      error: undefined,
      touchedAt: Date.now(),
    });
    return true;
  },
});
export const failed = internalMutation({
  args: { id: v.id("gallery_images"), attempt: v.string(), error: v.string() },
  handler: async (ctx, a) => {
    const i = await ctx.db.get(a.id);
    if (i?.attempt === a.attempt)
      await ctx.db.patch(i._id, {
        status: "error",
        error: a.error,
        touchedAt: Date.now(),
      });
  },
});
export const retry = internalMutation({
  args: { ticket: v.string(), key: v.string(), attempt: v.string() },
  handler: async (ctx, a) => {
    const auth = await authorize(ctx, a.ticket);
    if (!auth) fail("UNAUTHORIZED");
    const i = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", auth.space._id).eq("key", a.key),
      )
      .first();
    if (!i) fail("NOT_FOUND");
    if (i.status !== "error") return;
    if (!i.original) fail("UPLOAD_REQUIRED");
    await consumeProcessing(ctx, String(auth.user._id));
    for (const id of new Set([i.high, i.medium, i.thumb, i.placeholder]))
      if (id && id !== i.original) await ctx.storage.delete(id);
    const usage = await ctx.db
      .query("gallery_usage")
      .withIndex("by_space", (q) => q.eq("space_id", i.space_id))
      .first();
    if (usage)
      await ctx.db.patch(usage._id, {
        bytes: Math.max(0, usage.bytes - (i.storedBytes - i.originalBytes)),
      });
    await ctx.db.patch(i._id, {
      high: undefined,
      medium: undefined,
      thumb: undefined,
      placeholder: undefined,
      storedBytes: i.originalBytes,
      status: "processing",
      attempt: a.attempt,
      error: undefined,
      touchedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.gallery.files.process, {
      id: i._id,
      attempt: a.attempt,
    });
  },
});
export const detachAlbum = internalMutation({
  args: {
    spaceId: v.id("spaces"),
    albumId: v.id("gallery_albums"),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("gallery_images")
      .withIndex("by_space_uploaded", (q) => q.eq("space_id", a.spaceId))
      .paginate({ numItems: 100, cursor: a.cursor ?? null });
    for (const i of page.page)
      if (i.albumIds.includes(a.albumId))
        await ctx.db.patch(i._id, {
          albumIds: i.albumIds.filter((id) => id !== a.albumId),
          revision: i.revision + 1,
        });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.gallery.store.detachAlbum, {
        ...a,
        cursor: page.continueCursor,
      });
  },
});
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const status of ["uploading", "processing"]) {
      const stale = await ctx.db
        .query("gallery_images")
        .withIndex("by_status_touched", (q) =>
          q.eq("status", status).lt("touchedAt", Date.now() - 15 * 60000),
        )
        .take(100);
      for (const i of stale)
        await ctx.db.patch(i._id, {
          status: "error",
          error: "INTERRUPTED",
          touchedAt: Date.now(),
        });
    }
  },
});
