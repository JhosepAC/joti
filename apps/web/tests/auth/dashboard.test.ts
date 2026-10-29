import { describe, expect, test } from "vitest";
import { api, sha256Hex, testClient } from "./helpers";
import type { DashboardData } from "../../features/spaces/types/dashboard.types";

async function fixture(purpose: "personal" | "blank" = "personal") {
  const t = testClient();
  const token = "test-dashboard-session";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "writer@example.com",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    await ctx.db.insert("auth_user_profiles", {
      user_id: user,
      username: "writer",
      display_name: "Writer",
      locale: "es",
      timezone: "UTC",
    });
    const session = await ctx.db.insert("auth_sessions", {
      user_id: user,
      token_hash: sha256Hex(token),
      created_at: Date.now(),
      expires_at: Date.now() + 60000,
    });
    const space = await ctx.db.insert("spaces", {
      owner_id: user,
      name: "My space",
      slug: "my-space",
      icon: "🏠",
      purpose,
      is_private: true,
      created_at: Date.now(),
    });
    return { user, session, space };
  });
  const call = (
    input: {
      operation?:
        | "load"
        | "create"
        | "save"
        | "favorite"
        | "rename"
        | "duplicate"
        | "icon"
        | "delete";
      [key: string]: unknown;
    } = {},
  ) =>
    t.action(api.spaces.dashboard.operate, {
      token,
      slug: "my-space",
      locale: "es",
      operation: "load",
      ...input,
    } as never) as Promise<DashboardData>;
  return { t, token, rows, call };
}

describe("workspace pages", () => {
  test("icons persist on copies and deletion respects revisions without recreating the starter", async () => {
    const { call } = await fixture();
    const page = (await call()).pages[0]!;
    await call({ operation: "icon", pageId: page.id, icon: "book" });
    expect((await call()).pages[0]!.icon).toBe("book");
    await expect(
      call({ operation: "icon", pageId: page.id, icon: "invalid" }),
    ).rejects.toThrow("VALIDATION_ERROR");
    const copied = await call({ operation: "duplicate", pageId: page.id });
    const copy = copied.pages.find((p) => p.id === copied.selectedPageId)!;
    expect(copy.icon).toBe("book");
    await expect(
      call({ operation: "delete", pageId: page.id, revision: 0 }),
    ).rejects.toThrow("CONFLICT");
    await call({ operation: "delete", pageId: page.id, revision: 1 });
    await call({ operation: "delete", pageId: copy.id, revision: 1 });
    expect((await call()).pages).toHaveLength(0);
  });
  test("page tree actions persist favorites, copy content and protect renames with revisions", async () => {
    const { call } = await fixture();
    const page = (await call()).pages[0]!;
    await call({ operation: "favorite", pageId: page.id, favorite: true });
    expect((await call()).pages[0]?.favorite).toBe(true);
    expect((await call()).pages[0]?.revision).toBe(1);
    await call({
      operation: "rename",
      pageId: page.id,
      title: "Renamed",
      revision: 1,
    });
    await expect(
      call({
        operation: "rename",
        pageId: page.id,
        title: "Stale",
        revision: 1,
      }),
    ).rejects.toThrow("CONFLICT");
    const result = await call({ operation: "duplicate", pageId: page.id });
    const copy = result.pages.find(
      (item) => item.id === result.selectedPageId,
    )!;
    expect(copy.title).toBe("Renamed (copia)");
    expect(copy.body).toBe(page.body);
    expect(copy.favorite).toBe(false);
    expect(copy.id).not.toBe(page.id);
  });
  test("first visit creates one starter page, including concurrent loads", async () => {
    const { call } = await fixture();
    const [first, second] = await Promise.all([call(), call()]);
    expect(first.pages).toHaveLength(1);
    expect(second.pages).toHaveLength(1);
    expect(first.pages[0]!.title).toBe("Empieza aquí");
    expect(first.profile.displayName).toBe("Writer");
    expect((await call()).pages[0]!.id).toBe(first.pages[0]!.id);
  });
  test("blank spaces start with an empty page and localize the title", async () => {
    const { call } = await fixture("blank");
    const data = await call({ locale: "en" });
    expect(data.pages[0]!.body).toBe("");
    expect(data.pages[0]!.title).toBe("Untitled");
  });
  test("create and save persist text and advance the revision", async () => {
    const { call } = await fixture();
    const data = await call({ operation: "create" });
    const page = data.pages.find((page) => page.id === data.selectedPageId)!;
    await call({
      operation: "save",
      pageId: page.id,
      title: "  My idea  ",
      body: "A thought worth keeping",
      revision: page.revision,
    });
    const saved = (await call()).pages.find((item) => item.id === page.id)!;
    expect(saved.title).toBe("My idea");
    expect(saved.body).toBe("A thought worth keeping");
    expect(saved.revision).toBe(2);
  });
  test("stale writes cannot overwrite changes from another tab", async () => {
    const { call } = await fixture();
    const page = (await call()).pages[0]!;
    await call({
      operation: "save",
      pageId: page.id,
      title: "First",
      body: "Kept",
      revision: 1,
    });
    await expect(
      call({
        operation: "save",
        pageId: page.id,
        title: "Stale",
        body: "Lost",
        revision: 1,
      }),
    ).rejects.toThrow("CONFLICT");
    expect((await call()).pages[0]!.body).toBe("Kept");
  });
  test("expired and revoked sessions cannot read or write", async () => {
    const { call, t, rows } = await fixture();
    await t.run((ctx) => ctx.db.patch(rows.session, { expires_at: 1 }));
    await expect(call()).rejects.toThrow("UNAUTHORIZED");
    await t.run((ctx) => ctx.db.delete(rows.session));
    await expect(call({ operation: "create" })).rejects.toThrow("UNAUTHORIZED");
  });
  test("knowing another owner's slug or page id grants no access", async () => {
    const { call, t } = await fixture();
    const foreign = await t.run(async (ctx) => {
      const user = await ctx.db.insert("auth_users", {
        email: "other@example.com",
        failed_login_attempts: 0,
        email_verified_at: 1,
      });
      const space = await ctx.db.insert("spaces", {
        owner_id: user,
        name: "Private",
        slug: "private",
        icon: "🏠",
        purpose: "personal",
        is_private: true,
        created_at: 1,
      });
      return ctx.db.insert("space_pages", {
        space_id: space,
        title: "Secret",
        body: "Private",
        revision: 1,
        created_at: 1,
        updated_at: 1,
        is_starter: false,
      });
    });
    await expect(call({ slug: "private" })).rejects.toThrow("NOT_FOUND");
    await expect(
      call({ operation: "delete", pageId: foreign, revision: 1 }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      call({ operation: "icon", pageId: foreign, icon: "book" }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      call({
        operation: "save",
        pageId: foreign,
        title: "Stolen",
        body: "",
        revision: 1,
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
  test("invalid saves keep the previous page intact", async () => {
    const { call } = await fixture();
    const page = (await call()).pages[0]!;
    await expect(
      call({
        operation: "save",
        pageId: page.id,
        title: " ",
        body: "",
        revision: 1,
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
    await expect(
      call({
        operation: "save",
        pageId: page.id,
        title: "Title",
        body: "x".repeat(30001),
        revision: 1,
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
    expect((await call()).pages[0]!.revision).toBe(1);
  });
});
