import { describe, expect, test } from "vitest";
import { api, sha256Hex, testClient } from "./helpers";
async function fixture() {
  const t = testClient(),
    token = "account-settings-session-1234567890";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "account@example.test",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    const profile = await ctx.db.insert("auth_user_profiles", {
      user_id: user,
      display_name: "Writer",
      username: "writer",
      locale: "es",
      timezone: "system",
    });
    const session = await ctx.db.insert("auth_sessions", {
      user_id: user,
      token_hash: sha256Hex(token),
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    });
    return { user, profile, session };
  });
  const call = (args: Record<string, unknown> = {}) =>
    t.action(api.account.actions.operate, {
      token,
      operation: "load",
      ...args,
    } as never) as Promise<{
      name: string;
      username: string;
      locale: string;
      email: string;
      sessions: { id: string; current: boolean }[];
      avatarUrl: string | null;
    }>;
  return { t, token, rows, call };
}
describe("account settings", () => {
  test("uploaded avatars replace managed storage and can be removed", async () => {
    const f = await fixture();
    const bytes = Uint8Array.from(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    ).buffer;
    await f.t.action(api.account.actions.upload, { token: f.token, bytes });
    const first = await f.t.run((ctx) => ctx.db.get(f.rows.profile));
    expect(first?.managed_avatar_id).toBeTruthy();
    await f.t.action(api.account.actions.upload, { token: f.token, bytes });
    expect(
      await f.t.run((ctx) => ctx.storage.get(first!.managed_avatar_id!)),
    ).toBeNull();
    await f.call({ operation: "removeAvatar" });
    expect((await f.call()).avatarUrl).toBeNull();
  });
  test("session-scoped profile edits persist normalized fields and preferences", async () => {
    const f = await fixture();
    const result = await f.call({
      operation: "save",
      name: "  My name ",
      username: " WRITER_TWO ",
      locale: "en",
    });
    expect(result.name).toBe("My name");
    expect(result.username).toBe("writer_two");
    expect((await f.call()).locale).toBe("en");
    expect(result.sessions[0]?.current).toBe(true);
    expect(result).not.toHaveProperty("token_hash");
  });
  test("username conflicts and invalid fields leave the profile unchanged", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const owner = await ctx.db.insert("auth_users", {
        email: "taken@example.test",
        failed_login_attempts: 0,
      });
      return ctx.db.insert("auth_user_profiles", {
        user_id: owner,
        display_name: "Another",
        username: "taken",
        locale: "es",
        timezone: "system",
      });
    });
    await expect(
      f.call({
        operation: "save",
        name: "Name",
        username: "taken",
        locale: "es",
      }),
    ).rejects.toThrow("USERNAME_TAKEN");
    for (const extra of [{ name: "" }, { username: "bad!" }, { locale: "xx" }])
      await expect(
        f.call({
          operation: "save",
          name: "Name",
          username: "writer",
          locale: "es",
          ...extra,
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
    expect((await f.call()).name).toBe("Writer");
  });
  test("revoking other sessions preserves the current session and blocks the revoked one", async () => {
    const f = await fixture();
    const other = "other-account-session-1234567890";
    await f.t.run((ctx) =>
      ctx.db.insert("auth_sessions", {
        user_id: f.rows.user,
        token_hash: sha256Hex(other),
        created_at: Date.now(),
        expires_at: Date.now() + 3600000,
      }),
    );
    expect((await f.call()).sessions.length).toBe(2);
    expect((await f.call({ operation: "revokeOthers" })).sessions.length).toBe(
      1,
    );
    await expect(f.call({ token: other })).rejects.toThrow("UNAUTHORIZED");
  });
  test("knowing another user's session id cannot revoke it or alter their account", async () => {
    const f = await fixture();
    const other = await f.t.run(async (ctx) => {
      const user = await ctx.db.insert("auth_users", {
        email: "other-account@example.test",
        failed_login_attempts: 0,
        email_verified_at: 1,
      });
      return ctx.db.insert("auth_sessions", {
        user_id: user,
        token_hash: "foreign",
        created_at: Date.now(),
        expires_at: Date.now() + 3600000,
      });
    });
    await expect(
      f.call({ operation: "revoke", sessionId: other }),
    ).rejects.toThrow("NOT_FOUND");
    expect(await f.t.run((ctx) => ctx.db.get(other))).not.toBeNull();
    await expect(
      f.call({ operation: "revoke", sessionId: f.rows.session }),
    ).rejects.toThrow("NOT_FOUND");
  });
  test("expired sessions cannot load or edit profiles", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.rows.session, { expires_at: 1 }));
    await expect(f.call()).rejects.toThrow("UNAUTHORIZED");
    await expect(
      f.call({
        operation: "save",
        name: "Changed",
        username: "writer",
        locale: "es",
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  test("avatar writes reject non-images and oversized files before storing", async () => {
    const f = await fixture();
    await expect(
      f.t.action(api.account.actions.upload, {
        token: f.token,
        bytes: new Uint8Array(30).buffer,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    await expect(
      f.t.action(api.account.actions.upload, {
        token: f.token,
        bytes: new Uint8Array(512 * 1024 + 1).buffer,
      }),
    ).rejects.toThrow("INVALID_IMAGE");
    expect((await f.call()).avatarUrl).toBeNull();
  });
});
