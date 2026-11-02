import { describe, test, expect, vi, afterEach } from "vitest";
import sharp from "sharp";
import { api, internal, testClient, sha256Hex } from "./helpers";
import { derive, sniff } from "../../convex/gallery/processing";
import { DEFAULT_PREFERENCES } from "../../convex/gallery/model";
import { archive } from "../../features/gallery/server/archive";
afterEach(() => vi.useRealTimers());
async function fixture() {
  const t = testClient(),
    token = "gallery-session-12345678901234567890",
    ticket = "gallery-ticket-12345678901234567890";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "gallery@example.test",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    const session = await ctx.db.insert("auth_sessions", {
      token_hash: sha256Hex(token),
      user_id: user,
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    });
    const space = await ctx.db.insert("spaces", {
      owner_id: user,
      name: "Gallery",
      slug: "gallery-test",
      icon: "🎨",
      purpose: "personal",
      is_private: true,
      created_at: Date.now(),
    });
    return { user, session, space };
  });
  await t.mutation(internal.lists.access.mint, {
    session_hash: sha256Hex(token),
    ticket_hash: sha256Hex(ticket),
    slug: "gallery-test",
  });
  const browse = (
    a: Partial<
      Parameters<typeof t.query<typeof api.gallery.data.browse>>[1]
    > = {},
  ) =>
    t.query(api.gallery.data.browse, {
      ticket,
      sort: "uploaded",
      direction: "desc",
      search: "",
      album: "",
      tag: "",
      mime: "",
      paginationOpts: { numItems: 60, cursor: null },
      ...a,
    });
  let seq = 0;
  const reserve = (hash = `hash-${++seq}`) =>
    t.mutation(internal.gallery.store.reserve, {
      ticket,
      key: `image-key-${seq}`,
      hash,
      filename: "image.png",
      mime: "image/png",
      bytes: 100,
      attempt: "attempt-one",
    });
  const album = (name: string) =>
    t.mutation(api.gallery.data.album, {
      ticket,
      kind: "create",
      name,
      description: "",
      color: "blue",
    });
  return { t, token, ticket, rows, browse, reserve, album };
}
describe("private workspace gallery", () => {
  test("requires live scoped grants and hides storage identifiers", async () => {
    const f = await fixture();
    await f.reserve();
    const data = await f.browse();
    expect(data.page).toHaveLength(1);
    expect(data.page[0]).not.toHaveProperty("original");
    expect(data.page[0]).not.toHaveProperty("hash");
    expect((await f.browse({ ticket: "invalid" })).page).toEqual([]);
    await f.t.run((ctx) => ctx.db.delete(f.rows.session));
    await expect(
      f.t.mutation(api.gallery.data.bulk, {
        ticket: f.ticket,
        keys: ["image-key-1"],
        kind: "delete",
      }),
    ).rejects.toThrow("UNAUTHORIZED");
    await expect(
      f.t.query(internal.gallery.store.media, {
        hash: sha256Hex(f.token),
        slug: "gallery-test",
        key: "image-key-1",
        variant: "original",
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  test("deduplicates simultaneous reservations per space", async () => {
    const f = await fixture();
    const [first,second] = await Promise.all([f.reserve("same"),f.reserve("same")]);
    expect(second.key).toBe(first.key);
    expect(second.duplicate).toBe(true);
    expect((await f.browse()).page).toHaveLength(1);
    expect(
      (await f.t.query(api.gallery.data.overview, { ticket: f.ticket })).count,
    ).toBe(1);
  });
  test("checks quota before retaining a new image", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("gallery_usage", {
        space_id: f.rows.space,
        count: 5000,
        bytes: 0,
      }),
    );
    await expect(f.reserve()).rejects.toThrow("STORAGE_LIMIT");
  });
  test("preferences persist and invalid modes are rejected", async () => {
    const f = await fixture(),
      value = { ...DEFAULT_PREFERENCES, view: "masonry", size: "large" };
    await f.t.mutation(api.gallery.data.preferences, {
      ticket: f.ticket,
      value,
    });
    expect(
      (await f.t.query(api.gallery.data.overview, { ticket: f.ticket }))
        .preferences,
    ).toEqual(value);
    await expect(
      f.t.mutation(api.gallery.data.preferences, {
        ticket: f.ticket,
        value: { ...value, view: "invalid" },
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
  });
  test("albums/tags edit, multiple memberships, filters and revision conflict", async () => {
    const f = await fixture(),
      i = await f.reserve(),
      a = await f.album("Travel"),
      b = await f.album("Inspiration");
    await f.t.mutation(api.gallery.data.edit, {
      ticket: f.ticket,
      key: i.key,
      revision: 1,
      title: "Coast",
      description: "A quiet bay",
      tags: [" Travel ", "travel"],
      albumIds: [a!, b!],
    });
    expect(
      (
        await f.browse({
          album: String(a),
          tag: "travel",
          search: "quiet",
          mime: "image/png",
        })
      ).page[0]?.title,
    ).toBe("Coast");
    expect((await f.browse({ search: "missing" })).page).toEqual([]);
    await expect(
      f.t.mutation(api.gallery.data.edit, {
        ticket: f.ticket,
        key: i.key,
        revision: 1,
        title: "Old",
        description: "",
        tags: [],
        albumIds: [],
      }),
    ).rejects.toThrow("CONFLICT");
    await f.t.mutation(api.gallery.data.bulk, {
      ticket: f.ticket,
      kind: "removeAlbum",
      keys: [i.key],
      albumId: a!,
    });
    expect((await f.browse()).page[0]?.albumIds).toEqual([b]);
  });
  test("deleting an album retains images and files", async () => {
    vi.useFakeTimers();
    const f = await fixture(),
      i = await f.reserve(),
      album = await f.album("Travel");
    await f.t.mutation(api.gallery.data.bulk, {
      ticket: f.ticket,
      kind: "addAlbum",
      keys: [i.key],
      albumId: album!,
    });
    await f.t.mutation(api.gallery.data.album, {
      ticket: f.ticket,
      kind: "delete",
      id: album!,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect((await f.browse()).page[0]?.albumIds).toEqual([]);
    expect((await f.browse()).page).toHaveLength(1);
  });
  test("validates cross-space albums and ownership changes", async () => {
    const f = await fixture(),
      i = await f.reserve();
    const foreign = await f.t.run(async (ctx) => {
      const space = await ctx.db.insert("spaces", {
        owner_id: f.rows.user,
        name: "Other",
        slug: "other",
        icon: "🏠",
        purpose: "personal",
        is_private: true,
        created_at: 1,
      });
      return await ctx.db.insert("gallery_albums", {
        space_id: space,
        name: "Other",
        description: "",
        color: "blue",
        createdAt: 1,
      });
    });
    await expect(
      f.t.mutation(api.gallery.data.bulk, {
        ticket: f.ticket,
        kind: "addAlbum",
        keys: [i.key],
        albumId: foreign,
      }),
    ).rejects.toThrow("NOT_FOUND");
    await f.t.run((ctx) =>
      ctx.db.patch(f.rows.space, { deleted_at: Date.now() }),
    );
    expect((await f.browse()).page).toEqual([]);
  });
  test("permanent deletion removes original/derivatives and releases usage once", async () => {
    const f = await fixture(),
      i = await f.reserve();
    const ids = await f.t.run(async (ctx) => {
      const a = await ctx.storage.store(new Blob(["original"])),
        b = await ctx.storage.store(new Blob(["thumb"]));
      await ctx.db.patch(i.id, { original: a, thumb: b });
      return [a, b];
    });
    await f.t.mutation(api.gallery.data.bulk, {
      ticket: f.ticket,
      keys: [i.key],
      kind: "delete",
    });
    await f.t.mutation(api.gallery.data.bulk, {
      ticket: f.ticket,
      keys: [i.key],
      kind: "delete",
    });
    expect((await f.browse()).page).toEqual([]);
    expect(await f.t.run((ctx) => ctx.storage.get(ids[0]!))).toBeNull();
    expect(await f.t.run((ctx) => ctx.storage.get(ids[1]!))).toBeNull();
    const usage = await f.t.query(api.gallery.data.overview, {
      ticket: f.ticket,
    });
    expect(usage.count).toBe(0);
    expect(usage.bytes).toBe(0);
  });
  test("bounded pagination handles a thousand records and manual ordering", async () => {
    const f = await fixture();
    const first = await f.reserve(),
      second = await f.reserve();
    await f.t.mutation(api.gallery.data.move, {
      ticket: f.ticket,
      key: second.key,
      beforeKey: first.key,
    });
    expect(
      (await f.browse({ sort: "manual", direction: "asc" })).page[0]?.key,
    ).toBe(second.key);
    await f.t.run(async (ctx) => {
      const base = await ctx.db.get(first.id);
      for (let n = 0; n < 1000; n++) {
        const { _id, _creationTime, ...fields } = base!;
        await ctx.db.insert("gallery_images", {
          ...fields,
          key: `many-image-${n}`,
          hash: `many-hash-${n}`,
          uploadedAt: n,
        });
      }
    });
    const p = await f.browse();
    expect(p.page.length).toBe(60);
    expect(p.isDone).toBe(false);
    const next = await f.browse({
      paginationOpts: { numItems: 60, cursor: p.continueCursor },
    });
    expect(next.page.length).toBe(60);
    expect(new Set([...p.page, ...next.page].map((i) => i.key)).size).toBe(120);
  });
  test("upload, background processing, exact original and derived media work end to end", async () => {
    vi.useFakeTimers();
    const f = await fixture(),
      png = await sharp({
        create: {
          width: 1200,
          height: 600,
          channels: 4,
          background: { r: 50, g: 100, b: 180, alpha: 0.4 },
        },
      })
        .png()
        .toBuffer();
    const input = {
      ticket: f.ticket,
      key: "upload-image-123",
      filename: "transparent.png",
      bytes: new Uint8Array(png).buffer,
    };
    const result = await f.t.action(api.gallery.uploads.upload, input);
    expect(result.duplicate).toBe(false);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const image = (await f.browse()).page[0]!;
    expect(image.status).toBe("ready");
    expect(image.width).toBe(1200);
    expect(image.height).toBe(600);
    const original = await f.t.action(api.gallery.files.media, {
      token: f.token,
      slug: "gallery-test",
      key: image.key,
      variant: "original",
    });
    expect(Buffer.from(original.bytes)).toEqual(png);
    const thumb = await f.t.action(api.gallery.files.media, {
      token: f.token,
      slug: "gallery-test",
      key: image.key,
      variant: "thumb",
    });
    const meta = await sharp(Buffer.from(thumb.bytes)).metadata();
    expect(meta.width).toBe(480);
    expect(meta.hasAlpha).toBe(true);
    await f.t.run(async (ctx) => {
      const row = await ctx.db
        .query("gallery_images")
        .withIndex("by_space_key", (q) =>
          q.eq("space_id", f.rows.space).eq("key", image.key),
        )
        .first();
      if (row?.thumb) await ctx.storage.delete(row.thumb);
    });
    const fallback = await f.t.action(api.gallery.files.media, {
      token: f.token,
      slug: "gallery-test",
      key: image.key,
      variant: "thumb",
    });
    expect((await sharp(Buffer.from(fallback.bytes)).metadata()).width).toBe(
      1200,
    );
    const duplicate = await f.t.action(api.gallery.uploads.upload, {
      ...input,
      key: "duplicate-image-123",
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.key).toBe(image.key);
  });
  test("bad real content fails safely and can be deleted", async () => {
    vi.useFakeTimers();
    const f = await fixture(),
      fake = new Uint8Array(32);
    fake.set([137, 80, 78, 71, 13, 10, 26, 10]);
    await f.t.action(api.gallery.uploads.upload, {
      ticket: f.ticket,
      key: "broken-image-123",
      filename: "fake.png",
      bytes: fake.buffer,
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect((await f.browse()).page[0]?.status).toBe("error");
    await expect(
      f.t.action(api.gallery.uploads.upload, {
        ticket: f.ticket,
        key: "wrong-type-1234",
        filename: "fake.jpg",
        bytes: new TextEncoder().encode("<svg>not a photo</svg>").buffer,
      }),
    ).rejects.toThrow("UNSUPPORTED_FORMAT");
  });
  test('processing retry replaces derivatives once and retains a user-corrected capture date',async()=>{
    vi.useFakeTimers();const f=await fixture(),png=await sharp({create:{width:600,height:400,channels:3,background:'#4285f4'}}).png().toBuffer();
    const result=await f.t.action(api.gallery.uploads.upload,{ticket:f.ticket,key:'retry-image-123',filename:'photo.png',bytes:new Uint8Array(png).buffer});await f.t.finishAllScheduledFunctions(()=>vi.runAllTimers());
    const row=await f.t.run(ctx=>ctx.db.query('gallery_images').withIndex('by_space_key',q=>q.eq('space_id',f.rows.space).eq('key',result.key)).first());
    const date=Date.UTC(2020,2,10,12);
    await f.t.mutation(api.gallery.data.edit,{ticket:f.ticket,key:result.key,revision:1,title:'Corrected',description:'',tags:[],albumIds:[],capturedAt:date});
    await f.t.run(ctx=>ctx.db.patch(row!._id,{status:'error',error:'INTERRUPTED'}));
    await f.t.action(api.gallery.files.retry,{ticket:f.ticket,key:result.key});await f.t.finishAllScheduledFunctions(()=>vi.runAllTimers());
    const after=await f.t.run(ctx=>ctx.db.get(row!._id));expect(after?.status).toBe('ready');expect(after?.capturedAt).toBe(date);expect(after?.storedBytes).toBe(row?.storedBytes);expect(after?.title).toBe('Corrected');
    expect(await f.t.run(ctx=>ctx.storage.get(row!.high!))).toBeNull();
    expect((await f.t.query(api.gallery.data.overview,{ticket:f.ticket})).bytes).toBe(after?.storedBytes);
  });
});
describe("image processing and archive", () => {
  test("keeps high-resolution detail, accepts valid EXIF capture dates, and bounds hostile dimensions", async () => {
    const source = await sharp({
      create: { width: 5000, height: 2000, channels: 3, background: "#4c83a0" },
    })
      .jpeg()
      .withExif({ IFD0: { DateTime: "2023:06:15 10:30:00" } })
      .toBuffer();
    const out = await derive(source);
    expect(out.width).toBe(5000);
    expect(out.variants[0]?.width).toBe(3840);
    expect(out.variants[0]?.height).toBe(1536);
    expect(out.capturedAt).toBe(Date.UTC(2023, 5, 15, 10, 30));
    const huge = await sharp({
      create: { width: 6500, height: 6200, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();
    await expect(derive(huge)).rejects.toThrow(/pixel limit/i);
  });
  test.each(["jpeg", "png", "webp", "avif"] as const)(
    "generates four proportional WebP versions from %s",
    async (format) => {
      const source = await sharp({
        create: {
          width: 900,
          height: 1600,
          channels: 3,
          background: "#478297",
        },
      })
        .toFormat(format)
        .toBuffer();
      expect(sniff(source)).toBe(`image/${format}`);
      const out = await derive(source);
      expect(out.variants).toHaveLength(4);
      expect(out.variants[2]?.width).toBe(270);
      expect(out.variants[2]?.height).toBe(480);
      for (const v of out.variants)
        expect((await sharp(v.data).metadata()).format).toBe("webp");
    },
  );
  test("auto-orients EXIF, strips EXIF and preserves the original bytes", async () => {
    const source = await sharp({
        create: { width: 800, height: 400, channels: 3, background: "#4c83a0" },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
      copy = Buffer.from(source);
    const out = await derive(source);
    expect(out.width).toBe(400);
    expect(out.height).toBe(800);
    expect(out.variants[0]?.width).toBe(400);
    expect(
      (await sharp(out.variants[0]!.data).metadata()).exif,
    ).toBeUndefined();
    expect(source).toEqual(copy);
  });
  test("ZIP retains binary bytes, UTF-8 names and central directory offsets", async () => {
    const zip = Buffer.from(
      await archive([
        { name: "café.png", bytes: new Uint8Array([1, 2, 3]) },
        { name: "../photo.jpg", bytes: new Uint8Array([4, 5]) },
      ]).arrayBuffer(),
    );
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
    expect(zip.toString()).toContain("café.png");
    expect(zip.toString()).not.toContain("../photo");
    const known=Buffer.from(await archive([{name:'checksum.txt',bytes:new TextEncoder().encode('123456789')}]).arrayBuffer());expect(known.readUInt32LE(14)).toBe(0xcbf43926);
  });
});
