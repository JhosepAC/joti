import { test, expect } from "vitest";
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
});
