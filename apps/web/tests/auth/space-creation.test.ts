import { test, expect, vi } from "vitest";
import sharp from "sharp";
import { api } from "./helpers";
import { testClient, internal, sha256Hex } from "./helpers";
test("authenticated templates create private seeded spaces, retry safely, and preserve blank content", async () => {
  const t = testClient(),
    hash = sha256Hex("test-session");
  await t.run(async (ctx) => {
    const id = await ctx.db.insert("auth_users", {
      email: "space-creation@example.test",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    await ctx.db.insert("auth_sessions", {
      user_id: id,
      token_hash: hash,
      created_at: Date.now(),
      expires_at: Date.now() + 60000,
    });
  });
  for (const template of ["university", "work", "couple", "project", "blank"]) {
    const input = {
      hash,
      name: "Nuevo espacio",
      template,
      key: `operation-${template}`,
      locale: "es",
      background: template === "blank" ? "" : "#183A46",
    };
    const first = await t.mutation(internal.spaces.create.create, input),
      again = await t.mutation(internal.spaces.create.create, input);
    expect(first).toEqual(again);
    const result = await t.run(async (ctx) => {
      const s = await ctx.db
        .query("spaces")
        .withIndex("by_slug", (q) => q.eq("slug", first.slug))
        .first();
      return {
        space: s,
        pages: await ctx.db
          .query("space_pages")
          .withIndex("by_space_id", (q) => q.eq("space_id", s!._id))
          .collect(),
      };
    });
    expect(result.space?.is_private).toBe(true);
    expect(result.space?.icon_background).toBe(
      template === "blank" ? "" : "#183a46",
    );
    expect(result.pages.length).toBe(template === "blank" ? 1 : 3);
    expect(result.pages[0]?.body.length === 0).toBe(template === "blank");
  }
  await expect(
    t.mutation(internal.spaces.create.create, {
      hash: "invalid",
      name: "Nuevo espacio",
      template: "blank",
      key: "request-test",
      locale: "es",
    }),
  ).rejects.toThrow("UNAUTHORIZED");
  await expect(
    t.mutation(internal.spaces.create.create, {
      hash,
      name: "Nuevo espacio",
      template: "unknown",
      key: "request-test",
      locale: "es",
    }),
  ).rejects.toThrow("VALIDATION_ERROR");
  for (const background of [
    "black",
    "#fff",
    "#00000000",
    "url(https://example.com)",
  ]) {
    await expect(
      t.mutation(internal.spaces.create.create, {
        hash,
        name: "Invalid color",
        template: "blank",
        key: "invalid-color-test",
        locale: "es",
        background,
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
  }
});
test("space image icons are owned gallery media with strict dimensions", async () => {
  vi.useFakeTimers();
  try {
    const t = testClient(),
      token = "space-icon-session-12345678901234567890",
      hash = sha256Hex(token);
    await t.run(async (ctx) => {
      const user = await ctx.db.insert("auth_users", {
        email: "icon@example.test",
        email_verified_at: 1,
        failed_login_attempts: 0,
      });
      await ctx.db.insert("auth_sessions", {
        token_hash: hash,
        user_id: user,
        created_at: Date.now(),
        expires_at: Date.now() + 3600000,
      });
    });
    const s = await t.mutation(internal.spaces.create.create, {
      hash,
      name: "Icon space",
      template: "blank",
      key: "icon-create-123",
      locale: "es",
      icon: "symbol:plane",
    });
    const grant = await t.action(api.lists.session.connect, {
      token,
      slug: s.slug,
    });
    const png = await sharp({
      create: { width: 128, height: 128, channels: 3, background: "#4285f4" },
    })
      .png()
      .toBuffer();
    const image = await t.action(api.gallery.uploads.upload, {
      ticket: grant.ticket,
      key: "icon-image-123",
      filename: "icon.png",
      bytes: new Uint8Array(png).buffer,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.mutation(api.spaces.icons.set, {
      ticket: grant.ticket,
      key: image.key,
    });
    expect(
      await t.run(
        async (ctx) =>
          (
            await ctx.db
              .query("spaces")
              .withIndex("by_slug", (q) => q.eq("slug", s.slug))
              .first()
          )?.icon,
      ),
    ).toBe(`media:${s.slug}:${image.key}`);
    await expect(
      t.mutation(api.spaces.icons.set, { ticket: "invalid", key: image.key }),
    ).rejects.toThrow("UNAUTHORIZED");
    await expect(
      t.mutation(api.spaces.icons.set, {
        ticket: grant.ticket,
        key: "foreign-media-123",
      }),
    ).rejects.toThrow("INVALID_IMAGE");
  } finally {
    vi.useRealTimers();
  }
});
