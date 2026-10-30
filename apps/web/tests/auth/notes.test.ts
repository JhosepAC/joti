import { describe, test, expect } from "vitest";
import { api, internal, testClient, sha256Hex } from "./helpers";
import { validateNote, notePreview } from "../../convex/notes/model";
import type { NoteOperation } from "../../features/notes/hooks/use-notes";
const fields = {
  title: "Idea",
  body: "## A thought\n\nA **useful** idea",
  color: "plain",
  icon: "book",
  tags: ["project"],
  pinned: false,
  archived: false,
  trashed: false,
};
async function fixture() {
  const t = testClient(),
    token = "notes-session-test-12345678901234567890",
    ticket = "notes-access-test-12345678901234567890";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "notes@example.test",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    const session = await ctx.db.insert("auth_sessions", {
      user_id: user,
      token_hash: sha256Hex(token),
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    });
    const space = await ctx.db.insert("spaces", {
      owner_id: user,
      name: "Ideas",
      slug: "ideas",
      icon: "🏠",
      purpose: "personal",
      is_private: true,
      created_at: Date.now(),
    });
    return { user, space, session };
  });
  await t.mutation(internal.lists.access.mint, {
    session_hash: sha256Hex(token),
    ticket_hash: sha256Hex(ticket),
    slug: "ideas",
  });
  let seq = 0;
  const apply = (args: Omit<NoteOperation, "opId"> & { opId?: string }) =>
    t.mutation(api.notes.data.apply, {
      ticket,
      opId: `operation-${++seq}`,
      ...args,
    });
  const watch = (selectedKey = "note-12345678") =>
    t.query(api.notes.data.watch, { ticket, selectedKey });
  const create = () => apply({ kind: "create", key: "note-12345678", fields });
  return { t, rows, ticket, token, apply, watch, create };
}
describe("private workspace notes", () => {
  test("create, update and catalog persist content and metadata without leaking body into catalog", async () => {
    const f = await fixture();
    await f.create();
    let data = await f.watch();
    expect(data.note?.body).toBe(fields.body);
    expect(data.notes[0]).not.toHaveProperty("body");
    expect(data.notes[0]?.preview).toContain("useful");
    await f.apply({
      kind: "save",
      key: "note-12345678",
      revision: 1,
      fields: { ...fields, title: "Updated", pinned: true, tags: ["work"] },
    });
    data = await f.watch();
    expect(data.note?.revision).toBe(2);
    expect(data.notes[0]?.title).toBe("Updated");
    expect(data.history.length).toBe(1);
  });
  test("receipts prevent duplicate creates and reject reuse for a different payload", async () => {
    const f = await fixture();
    const op = {
      kind: "create" as const,
      key: "note-12345678",
      fields,
      opId: "stable-create",
    };
    await f.apply(op);
    await f.apply(op);
    expect((await f.watch()).notes.length).toBe(1);
    await expect(
      f.apply({ ...op, fields: { ...fields, title: "Other" } }),
    ).rejects.toThrow("VALIDATION_ERROR");
  });
  test("stale saves and deletions cannot overwrite a newer revision", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "save",
      key: "note-12345678",
      revision: 1,
      fields: { ...fields, title: "Kept" },
    });
    await expect(
      f.apply({ kind: "save", key: "note-12345678", revision: 1, fields }),
    ).rejects.toThrow("CONFLICT");
    await expect(
      f.apply({ kind: "delete", key: "note-12345678", revision: 1 }),
    ).rejects.toThrow("CONFLICT");
    expect((await f.watch()).note?.title).toBe("Kept");
  });
  test("trash is recoverable and permanent deletion cascades history and catalog with retry protection", async () => {
    const f = await fixture();
    await f.create();
    await expect(
      f.apply({ kind: "delete", key: "note-12345678", revision: 1 }),
    ).rejects.toThrow("TRASH_REQUIRED");
    await f.apply({
      kind: "save",
      key: "note-12345678",
      revision: 1,
      fields: { ...fields, trashed: true },
    });
    await expect(
      f.apply({
        kind: "save",
        key: "note-12345678",
        revision: 2,
        fields: { ...fields, body: "changed", trashed: true },
      }),
    ).rejects.toThrow("READ_ONLY");
    await f.apply({ kind: "save", key: "note-12345678", revision: 2, fields });
    await f.apply({
      kind: "save",
      key: "note-12345678",
      revision: 3,
      fields: { ...fields, trashed: true },
    });
    const op = {
      kind: "delete" as const,
      key: "note-12345678",
      revision: 4,
      opId: "stable-delete",
    };
    await f.apply(op);
    await f.apply(op);
    expect((await f.watch()).notes).toEqual([]);
    expect(
      await f.t.run((ctx) => ctx.db.query("note_versions").collect()),
    ).toEqual([]);
  });
  test("history is capped at ten and restore creates a new revision", async () => {
    const f = await fixture();
    await f.create();
    for (let i = 1; i <= 12; i++)
      await f.apply({
        kind: "save",
        key: "note-12345678",
        revision: i,
        fields: { ...fields, title: `Revision ${i}` },
      });
    const data = await f.watch();
    expect(data.history.length).toBe(10);
    const version = data.history.at(-1)!;
    await f.apply({
      kind: "restoreVersion",
      key: "note-12345678",
      revision: 13,
      versionId: version.id,
    });
    expect((await f.watch()).note?.title).toBe(version.title);
    expect((await f.watch()).note?.revision).toBe(14);
  });
  test("duplicate resets organizational flags and promotion creates only one page", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "duplicate",
      key: "note-12345678",
      revision: 1,
      newKey: "copy-12345678",
    });
    expect((await f.watch("copy-12345678")).note?.body).toBe(fields.body);
    const a = await f.apply({
      kind: "promote",
      key: "note-12345678",
      revision: 1,
    });
    const b = await f.apply({
      kind: "promote",
      key: "note-12345678",
      revision: 1,
    });
    expect(a.pageId).toBe(b.pageId);
    expect((await f.t.run((ctx) => ctx.db.get(a.pageId!)))?.body).toBe(
      fields.body,
    );
  });
  test("space grants isolate notes and revoked sessions cannot read or write", async () => {
    const f = await fixture();
    await f.create();
    await f.t.run((ctx) =>
      ctx.db.insert("spaces", {
        owner_id: f.rows.user,
        name: "Other",
        slug: "other",
        icon: "🏠",
        purpose: "personal",
        is_private: true,
        created_at: Date.now(),
      }),
    );
    const other = "other-notes-grant-12345678901234567890";
    await f.t.mutation(internal.lists.access.mint, {
      session_hash: sha256Hex(f.token),
      ticket_hash: sha256Hex(other),
      slug: "other",
    });
    expect(
      (
        await f.t.query(api.notes.data.watch, {
          ticket: other,
          selectedKey: "note-12345678",
        })
      ).note,
    ).toBeNull();
    await expect(
      f.t.mutation(api.notes.data.apply, {
        ticket: other,
        key: "note-12345678",
        opId: "foreign-delete",
        kind: "delete",
        revision: 1,
      }),
    ).rejects.toThrow("NOT_FOUND");
    await f.t.run((ctx) => ctx.db.delete(f.rows.session));
    expect((await f.watch()).status).toBe("expired");
    await expect(
      f.apply({ kind: "save", key: "note-12345678", fields, revision: 1 }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  test("note validation rejects invalid content and preview preserves readable link text", () => {
    for (const bad of [
      { title: " " },
      { body: "x".repeat(30001) },
      { tags: ["A", "a"] },
      { color: "invalid" },
      { icon: "missing" },
    ])
      expect(() => validateNote({ ...fields, ...bad })).toThrow(
        "VALIDATION_ERROR",
      );
    expect(notePreview("[Docs](https://example.com) **reference**")).toBe(
      "Docs reference",
    );
  });
});
