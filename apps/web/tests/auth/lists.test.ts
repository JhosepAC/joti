import { describe, expect, test } from "vitest";
import { api, internal, sha256Hex, testClient } from "./helpers";
import type { ListCommand, ListColumn } from "../../convex/lists/model";
import { templateColumns } from "../../convex/lists/templates";
import { projectSnapshot } from "../../features/lists/lib/optimistic";
import {
  calendarDays,
  dateKey,
  makeDate,
  parseDateKey,
} from "../../features/lists/lib/dates";
import {
  exportCsv,
  parseCsv,
  visibleRows,
} from "../../features/lists/lib/table";

async function fixture() {
  const t = testClient();
  const token = "a-test-session-token-for-lists-review";
  const ticket = "a-test-space-ticket-for-lists-review";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "lists@example.test",
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
      name: "Lists space",
      slug: "lists-space",
      icon: "🏠",
      purpose: "personal",
      is_private: true,
      created_at: Date.now(),
    });
    return { user, session, space };
  });
  await t.mutation(internal.lists.access.mint, {
    session_hash: sha256Hex(token),
    ticket_hash: sha256Hex(ticket),
    slug: "lists-space",
  });
  let sequence = 0;
  const apply = (command: ListCommand, opId = "operation-" + ++sequence) =>
    t.mutation(api.lists.data.apply, { ticket, opId, command });
  const watch = (selectedKey = "list-a") =>
    t.query(api.lists.data.watch, { ticket, selectedKey });
  const create = async (
    template: "tasks" | "shopping" | "packing" | "blank" = "tasks",
    key = "list-a",
  ) =>
    apply({
      kind: "createList",
      key,
      name: "My list",
      icon: "table",
      template,
      locale: "es",
    });
  return { t, token, ticket, rows, apply, watch, create };
}
describe("private realtime lists", () => {
  test("permanent deletion removes only scoped records and cascades list catalog and archived rows", async () => {
    const f = await fixture();
    await f.create("blank");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [
        { key: "one", cells: { name: "One" } },
        { key: "two", cells: { name: "Two" } },
      ],
    });
    await expect(
      f.apply({
        kind: "deleteRows",
        listKey: "list-a",
        rowKeys: ["one", "missing"],
      }),
    ).rejects.toThrow();
    expect((await f.watch()).rows).toHaveLength(2);
    await f.apply(
      { kind: "deleteRows", listKey: "list-a", rowKeys: ["one"] },
      "delete-row",
    );
    await f.apply(
      { kind: "deleteRows", listKey: "list-a", rowKeys: ["one"] },
      "delete-row",
    );
    expect((await f.watch()).rows.map((r) => r.key)).toEqual(["two"]);
    await expect(
      f.apply({ kind: "deleteList", listKey: "list-a", baseRevision: 0 }),
    ).rejects.toThrow("CONFLICT");
    await f.apply(
      { kind: "deleteList", listKey: "list-a", baseRevision: 1 },
      "delete-list",
    );
    await f.apply(
      { kind: "deleteList", listKey: "list-a", baseRevision: 1 },
      "delete-list",
    );
    expect((await f.watch()).lists).toHaveLength(0);
    expect(
      await f.t.run((ctx) => ctx.db.query("list_rows").collect()),
    ).toHaveLength(0);
  });
  test("retiring and restoring an option preserves cell values and saved filters", async () => {
    const f = await fixture();
    await f.create("shopping");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "a", cells: { name: "A", category: "fresh" } }],
    });
    let list = (await f.watch()).list!;
    await f.apply({
      kind: "setViews",
      listKey: list.key,
      baseRevision: 1,
      views: [
        {
          ...list.views[0]!,
          filters: [
            { columnId: "category", operator: "equals", value: "fresh" },
          ],
        },
      ],
    });
    list = (await f.watch()).list!;
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns: list.columns.map((c) =>
        c.id === "category"
          ? {
              ...c,
              options: c.options.map((o) =>
                o.id === "fresh"
                  ? { ...o, archived: true, label: "Fresh produce" }
                  : o,
              ),
            }
          : c,
      ),
    });
    let data = await f.watch();
    expect(data.rows[0]?.cells.category).toBe("fresh");
    expect(data.list?.views[0]?.filters).toHaveLength(1);
    expect(
      data.list?.columns.find((c) => c.id === "category")?.options[0]?.archived,
    ).toBe(true);
    list = data.list!;
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns: list.columns.map((c) => ({
        ...c,
        options: c.options.map((o) => ({ ...o, archived: false })),
      })),
    });
    data = await f.watch();
    expect(data.rows[0]?.cells.category).toBe("fresh");
    expect(data.list?.views[0]?.filters).toHaveLength(1);
  });
  test("favorites persist in the list and the lightweight catalog", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "updateList",
      listKey: "list-a",
      baseRevision: 1,
      favorite: true,
    });
    let data = await f.watch();
    expect(data.list?.favorite).toBe(true);
    expect(data.lists[0]?.favorite).toBe(true);
    expect(data.lists[0]?.revision).toBe(2);
    await f.apply({
      kind: "updateList",
      listKey: "list-a",
      baseRevision: 2,
      favorite: false,
    });
    data = await f.watch();
    expect(data.lists[0]?.favorite).toBe(false);
  });
  test("duplicating a complete list is atomic, idempotent and independent of its source", async () => {
    const f = await fixture();
    await f.create("shopping");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [
        {
          key: "one",
          cells: { name: "Original", quantity: 3 },
          icon: "book",
          notes: "Detail",
        },
        { key: "archived", cells: { name: "Kept in archive" } },
      ],
    });
    await f.apply({
      kind: "archiveRows",
      listKey: "list-a",
      rowKeys: ["archived"],
      archived: true,
    });
    const command: ListCommand = {
      kind: "duplicateList",
      listKey: "list-a",
      key: "copy",
      name: "Copy",
      baseRevision: 1,
    };
    await f.apply(command, "duplicate-once");
    await f.apply(command, "duplicate-once");
    const copy = await f.watch("copy");
    expect(copy.rows).toHaveLength(2);
    expect(copy.rows[0]?.notes).toBe("Detail");
    expect(copy.rows[1]?.archived).toBe(true);
    expect(copy.list?.columns).toEqual((await f.watch()).list?.columns);
    expect(copy.lists).toHaveLength(2);
    await f.apply({
      kind: "setCells",
      listKey: "copy",
      changes: [
        {
          rowKey: "one",
          columnId: "name",
          value: "Independent",
          baseVersion: 0,
        },
      ],
    });
    expect((await f.watch()).rows[0]?.cells.name).toBe("Original");
    await expect(
      f.apply({ ...command, key: "other", baseRevision: 0 }),
    ).rejects.toThrow("CONFLICT");
  });
  test("additional property types validate values and preserve numeric sorting", async () => {
    const f = await fixture();
    await f.create("blank");
    const list = (await f.watch()).list!;
    const columns: ListColumn[] = [
      ...list.columns,
      ...(["email", "phone", "currency", "percent", "rating"] as const).map(
        (type) => ({
          id: type,
          name: type,
          type,
          icon: "",
          width: 180,
          options: [],
          archived: false,
          ...(type === "currency" ? { currency: "PEN" } : {}),
        }),
      ),
    ];
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: 1,
      columns,
    });
    await f.apply({
      kind: "addRows",
      listKey: list.key,
      rows: [
        {
          key: "a",
          cells: {
            name: "A",
            email: "a@example.test",
            phone: "+51 999 111 222",
            currency: 120.5,
            percent: 75,
            rating: 4,
          },
        },
        { key: "b", cells: { name: "B", currency: 20 } },
      ],
    });
    for (const [columnId, value] of [
      ["email", "broken"],
      ["phone", "hello"],
      ["percent", 101],
      ["percent", -1],
      ["rating", 6],
      ["rating", 1.5],
    ] as const)
      await expect(
        f.apply({
          kind: "setCells",
          listKey: list.key,
          changes: [{ rowKey: "a", columnId, value, baseVersion: 0 }],
        }),
      ).rejects.toThrow("VALIDATION_ERROR");
    const data = await f.watch();
    expect(
      visibleRows(
        data.rows,
        columns,
        {
          ...data.list!.views[0]!,
          sorts: [{ columnId: "currency", direction: "asc" }],
        },
        "",
        "es",
      ).map((row) => row.key),
    ).toEqual(["b", "a"]);
    expect(exportCsv(data.rows, columns, "es")).toContain("PEN");
  });
  test("saved OR filters differ from AND filters and calculation configuration is typed", async () => {
    const f = await fixture();
    await f.create("shopping");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [
        { key: "a", cells: { name: "A", done: true, quantity: 1 } },
        { key: "b", cells: { name: "B", done: false, quantity: 4 } },
        { key: "c", cells: { name: "C", done: false, quantity: 1 } },
      ],
    });
    const data = await f.watch(),
      view = {
        ...data.list!.views[0]!,
        filterMode: "any" as const,
        filters: [
          { columnId: "done", operator: "equals" as const, value: true },
          { columnId: "quantity", operator: "gt" as const, value: 2 },
        ],
        calculations: { quantity: "average" as const },
      };
    await f.apply({
      kind: "setViews",
      listKey: "list-a",
      baseRevision: 1,
      views: [view],
    });
    expect(
      visibleRows(data.rows, data.list!.columns, view, "", "es").map(
        (row) => row.key,
      ),
    ).toEqual(["a", "b"]);
    expect(
      visibleRows(
        data.rows,
        data.list!.columns,
        { ...view, filterMode: "all" },
        "",
        "es",
      ),
    ).toHaveLength(0);
    await expect(
      f.apply({
        kind: "setViews",
        listKey: "list-a",
        baseRevision: 2,
        views: [{ ...view, calculations: { name: "sum" } }],
      }),
    ).rejects.toThrow("VALIDATION_ERROR");
  });
  test("custom calendar covers complete Monday-first weeks and real leap days", () => {
    expect(parseDateKey("2026-02-29")).toBeNull();
    expect(parseDateKey("2000-02-29")).not.toBeNull();
    expect(parseDateKey("1900-02-29")).toBeNull();
    const days = calendarDays(makeDate(2026, 1));
    expect(days).toHaveLength(42);
    expect(days[0]?.getDay()).toBe(1);
    expect(new Set(days.map(dateKey)).size).toBe(42);
    expect(dateKey(makeDate(99, 0, 1))).toBe("0099-01-01");
  });
  test("queued CSV import previews the actual imported schema and rows without duplicate acknowledgments", async () => {
    const f = await fixture();
    const snapshot = await f.watch();
    const command: ListCommand = {
      kind: "createList",
      key: "csv",
      name: "Imported",
      icon: "table",
      template: "blank",
      locale: "en",
      imported: { headers: ["Item", "Note"], rows: [["A", "B"]] },
    };
    const operation = { opId: "csv-operation", createdAt: 1, command };
    const preview = projectSnapshot(snapshot, [operation], "csv");
    expect(preview.list?.columns.map((c) => c.name)).toEqual(["Item", "Note"]);
    expect(preview.rows[0]?.cells).toEqual({
      "column-0": "A",
      "column-1": "B",
    });
    await f.apply(command, "csv-operation");
    const acknowledged = projectSnapshot(
      await f.watch("csv"),
      [operation],
      "csv",
    );
    expect(acknowledged.rows).toHaveLength(1);
  });
  test("UTF-8 row budgets reject an oversized update without changing existing data", async () => {
    const f = await fixture();
    await f.create("blank");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "a", cells: { name: "Kept" } }],
    });
    await expect(
      f.apply({
        kind: "setRow",
        listKey: "list-a",
        rowKey: "a",
        baseVersion: 0,
        notes: "界".repeat(8000),
      }),
    ).rejects.toThrow("LIMIT_REACHED");
    expect((await f.watch()).rows[0]?.notes).toBe("");
  });
  test("duplicate insertion respects its anchor and unchecked missing values filter as false", async () => {
    const f = await fixture();
    await f.create("shopping");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [
        { key: "a", cells: { name: "A" } },
        { key: "b", cells: { name: "B", done: true } },
      ],
    });
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      afterKey: "a",
      rows: [{ key: "copy", cells: { name: "A copy" } }],
    });
    const data = await f.watch();
    expect(data.rows.map((r) => r.key)).toEqual(["a", "copy", "b"]);
    const view = {
      ...data.list!.views[0]!,
      filters: [
        { columnId: "done", operator: "equals" as const, value: false },
      ],
    };
    expect(
      visibleRows(data.rows, data.list!.columns, view, "", "es").map(
        (r) => r.key,
      ),
    ).toEqual(["a", "copy"]);
  });
  test("templates have typed properties and one protected primary name", async () => {
    const f = await fixture();
    await f.create("shopping");
    const data = await f.watch();
    expect(data.status).toBe("ready");
    expect(data.list?.columns.map((col) => col.type)).toEqual([
      "checkbox",
      "title",
      "number",
      "select",
      "select",
      "text",
    ]);
    expect(data.rows).toEqual([]);
    expect(data.list?.views[0]?.name).toBe("Todos");
  });
  test("rows and cells persist without replacing unrelated cells", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "row-a", cells: { name: "First" } }],
    });
    await Promise.all([
      f.apply({
        kind: "setCells",
        listKey: "list-a",
        changes: [
          {
            rowKey: "row-a",
            columnId: "name",
            value: "Changed",
            baseVersion: 0,
          },
        ],
      }),
      f.apply({
        kind: "setCells",
        listKey: "list-a",
        changes: [
          {
            rowKey: "row-a",
            columnId: "notes",
            value: "Kept independently",
            baseVersion: 0,
          },
        ],
      }),
    ]);
    const row = (await f.watch()).rows[0]!;
    expect(row.cells.name).toBe("Changed");
    expect(row.cells.notes).toBe("Kept independently");
  });
  test("concurrent edits to the same cell cannot overwrite a newer version", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "row-a", cells: { name: "First" } }],
    });
    await f.apply({
      kind: "setCells",
      listKey: "list-a",
      changes: [
        {
          rowKey: "row-a",
          columnId: "name",
          value: "Saved first",
          baseVersion: 0,
        },
      ],
    });
    await expect(
      f.apply({
        kind: "setCells",
        listKey: "list-a",
        changes: [
          { rowKey: "row-a", columnId: "name", value: "Stale", baseVersion: 0 },
        ],
      }),
    ).rejects.toThrow("CONFLICT");
    expect((await f.watch()).rows[0]?.cells.name).toBe("Saved first");
  });
  test("retrying an operation id never creates duplicate rows or lists", async () => {
    const f = await fixture();
    const create: ListCommand = {
      kind: "createList",
      key: "list-a",
      name: "One list",
      icon: "table",
      template: "blank",
      locale: "en",
    };
    await Promise.all([
      f.apply(create, "same-create"),
      f.apply(create, "same-create"),
    ]);
    const add: ListCommand = {
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "row-a", cells: { name: "Only once" } }],
    };
    await f.apply(add, "same-row");
    await f.apply(add, "same-row");
    expect((await f.watch()).rows).toHaveLength(1);
    expect((await f.watch()).lists).toHaveLength(1);
  });
  test("typed cells reject invalid numbers, dates, URLs and option ids atomically", async () => {
    const f = await fixture();
    await f.create("shopping");
    let list = (await f.watch()).list!;
    const columns: ListColumn[] = [
      ...list.columns,
      {
        id: "date",
        name: "Date",
        type: "date",
        icon: "",
        width: 160,
        options: [],
        archived: false,
      },
      {
        id: "url",
        name: "Link",
        type: "url",
        icon: "",
        width: 180,
        options: [],
        archived: false,
      },
    ];
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns,
    });
    await f.apply({
      kind: "addRows",
      listKey: list.key,
      rows: [{ key: "row-a", cells: { name: "Milk", quantity: 2 } }],
    });
    for (const [columnId, value] of [
      ["quantity", "not numeric"],
      ["date", "2026-02-30"],
      ["url", "javascript:alert(1)"],
      ["category", "unknown"],
    ] as const)
      await expect(
        f.apply({
          kind: "setCells",
          listKey: list.key,
          changes: [
            {
              rowKey: "row-a",
              columnId: "name",
              value: "Must roll back",
              baseVersion: 0,
            },
            { rowKey: "row-a", columnId, value, baseVersion: 0 },
          ],
        }),
      ).rejects.toThrow();
    expect((await f.watch()).rows[0]?.cells.name).toBe("Milk");
  });
  test("property order, names, icons and widths are saved; name cannot be removed", async () => {
    const f = await fixture();
    await f.create();
    let list = (await f.watch()).list!;
    const columns = [...list.columns]
      .reverse()
      .map((col) =>
        col.id === "name"
          ? { ...col, name: "Idea", icon: "book", width: 420 }
          : col,
      );
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns,
    });
    list = (await f.watch()).list!;
    expect(list.columns.at(-1)?.name).toBe("Idea");
    expect(list.columns.at(-1)?.width).toBe(420);
    await expect(
      f.apply({
        kind: "setColumns",
        listKey: list.key,
        baseRevision: list.revision,
        columns: list.columns.map((col) =>
          col.type === "title" ? { ...col, archived: true } : col,
        ),
      }),
    ).rejects.toThrow("TITLE_REQUIRED");
  });
  test("lossless type conversions succeed and invalid conversions leave data intact", async () => {
    const f = await fixture();
    await f.create("blank");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "row-a", cells: { name: "One", notes: "24" } }],
    });
    let list = (await f.watch()).list!;
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns: list.columns.map((col) =>
        col.id === "notes" ? { ...col, type: "number" } : col,
      ),
    });
    expect((await f.watch()).rows[0]?.cells.notes).toBe(24);
    list = (await f.watch()).list!;
    await expect(
      f.apply({
        kind: "setColumns",
        listKey: list.key,
        baseRevision: list.revision,
        columns: list.columns.map((col) =>
          col.id === "notes" ? { ...col, type: "date" } : col,
        ),
      }),
    ).rejects.toThrow("TYPE_CONVERSION");
    expect((await f.watch()).rows[0]?.cells.notes).toBe(24);
  });
  test("archive and restore retain rows, properties and list data", async () => {
    const f = await fixture();
    await f.create("blank");
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [{ key: "row-a", cells: { name: "One", notes: "Keep" } }],
    });
    let list = (await f.watch()).list!;
    await f.apply({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns: list.columns.map((col) =>
        col.id === "notes" ? { ...col, archived: true } : col,
      ),
    });
    await f.apply({
      kind: "archiveRows",
      listKey: list.key,
      rowKeys: ["row-a"],
      archived: true,
    });
    expect((await f.watch()).rows[0]?.cells.notes).toBe("Keep");
    await f.apply({
      kind: "archiveRows",
      listKey: list.key,
      rowKeys: ["row-a"],
      archived: false,
    });
    list = (await f.watch()).list!;
    await f.apply({
      kind: "archiveList",
      listKey: list.key,
      baseRevision: list.revision,
      archived: true,
    });
    list = (await f.watch()).list!;
    await expect(
      f.apply({
        kind: "setCells",
        listKey: list.key,
        changes: [
          { rowKey: "row-a", columnId: "name", value: "No", baseVersion: 0 },
        ],
      }),
    ).rejects.toThrow("ARCHIVED");
    await f.apply({
      kind: "archiveList",
      listKey: list.key,
      baseRevision: list.revision,
      archived: false,
    });
    expect((await f.watch()).rows[0]?.cells.notes).toBe("Keep");
  });
  test("saved views retain independent filters, sorts and visibility", async () => {
    const f = await fixture();
    await f.create("shopping");
    const list = (await f.watch()).list!;
    const next = {
      id: "unbought",
      name: "To buy",
      hidden: ["notes"],
      filters: [
        { columnId: "done", operator: "equals" as const, value: false },
      ],
      sorts: [{ columnId: "quantity", direction: "desc" as const }],
      groupBy: "category",
      wrap: true,
    };
    await f.apply({
      kind: "setViews",
      listKey: list.key,
      baseRevision: list.revision,
      views: [...list.views, next],
    });
    expect((await f.watch()).list?.views[1]).toEqual(next);
    await expect(
      f.apply({
        kind: "setViews",
        listKey: list.key,
        baseRevision: 2,
        views: [{ ...next, hidden: ["name"] }],
      }),
    ).rejects.toThrow("TITLE_REQUIRED");
  });
  test("revoking or expiring the durable session revokes live tickets", async () => {
    const f = await fixture();
    await f.create();
    await f.t.run((ctx) => ctx.db.patch(f.rows.session, { expires_at: 1 }));
    expect((await f.watch()).status).toBe("expired");
    await expect(
      f.apply({
        kind: "addRows",
        listKey: "list-a",
        rows: [{ key: "bad", cells: {} }],
      }),
    ).rejects.toThrow("UNAUTHORIZED");
  });
  test("a ticket cannot address another owner's list or space", async () => {
    const f = await fixture();
    await f.create();
    await f.t.run(async (ctx) => {
      const user = await ctx.db.insert("auth_users", {
        email: "other@example.test",
        email_verified_at: 1,
        failed_login_attempts: 0,
      });
      const space = await ctx.db.insert("spaces", {
        owner_id: user,
        name: "Other",
        slug: "other",
        icon: "🏠",
        purpose: "personal",
        is_private: true,
        created_at: 1,
      });
      await ctx.db.insert("space_lists", {
        space_id: space,
        key: "foreign",
        name: "Secret",
        description: "",
        icon: "table",
        columns: templateColumns("blank", "en"),
        views: [
          {
            id: "all",
            name: "All",
            hidden: [],
            filters: [],
            sorts: [],
            groupBy: "",
            wrap: false,
          },
        ],
        revision: 1,
        archived: false,
        created_at: 1,
        updated_at: 1,
      });
    });
    expect((await f.watch("foreign")).list).toBeNull();
    await expect(
      f.apply({
        kind: "updateList",
        listKey: "foreign",
        baseRevision: 1,
        name: "Stolen",
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
  test("two tickets for one session remain usable; expired ticket is denied", async () => {
    const f = await fixture();
    const second = "another-test-ticket-for-lists-review";
    await f.t.mutation(internal.lists.access.mint, {
      session_hash: sha256Hex(f.token),
      ticket_hash: sha256Hex(second),
      slug: "lists-space",
    });
    await f.create();
    expect((await f.watch()).status).toBe("ready");
    expect(
      (await f.t.query(api.lists.data.watch, { ticket: second })).status,
    ).toBe("ready");
    await f.t.run(async (ctx) => {
      const access = await ctx.db
        .query("list_access")
        .withIndex("by_token_hash", (q) =>
          q.eq("token_hash", sha256Hex(second)),
        )
        .first();
      await ctx.db.patch(access!._id, { expires_at: 1 });
    });
    expect(
      (await f.t.query(api.lists.data.watch, { ticket: second })).status,
    ).toBe("expired");
  });
  test("row reordering moves data without rewriting cells", async () => {
    const f = await fixture();
    await f.create();
    await f.apply({
      kind: "addRows",
      listKey: "list-a",
      rows: [
        { key: "a", cells: { name: "A" } },
        { key: "b", cells: { name: "B" } },
        { key: "c", cells: { name: "C" } },
      ],
    });
    await f.apply({
      kind: "moveRow",
      listKey: "list-a",
      rowKey: "c",
      beforeKey: "a",
    });
    expect((await f.watch()).rows.map((row) => row.key)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  test("CSV import creates one list atomically and escapes spreadsheet formulas on export", async () => {
    const f = await fixture();
    await f.apply({
      kind: "createList",
      key: "list-a",
      name: "Imported",
      icon: "table",
      template: "blank",
      locale: "es",
      imported: parseCsv(
        'Name,Note\r\n"A, B","line 1\nline 2"\r\nFormula,=SUM(A1)',
      ),
    });
    const data = await f.watch();
    expect(data.rows[0]?.cells["column-1"]).toBe("line 1\nline 2");
    const csv = exportCsv(data.rows, data.list!.columns, "en");
    expect(csv).toContain("'=SUM(A1)");
    expect(() => parseCsv('A,B\n"not closed')).toThrow("IMPORT_ERROR");
  });
  test("a row from a different list cannot be edited by a matching key lookup", async () => {
    const f = await fixture();
    await f.create("blank");
    await f.create("blank", "list-b");
    await f.apply({
      kind: "addRows",
      listKey: "list-b",
      rows: [{ key: "same-row", cells: { name: "Private in B" } }],
    });
    await expect(
      f.apply({
        kind: "setCells",
        listKey: "list-a",
        changes: [
          {
            rowKey: "same-row",
            columnId: "name",
            value: "Wrong list",
            baseVersion: 0,
          },
        ],
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
