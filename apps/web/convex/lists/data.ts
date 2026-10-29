import { mutation, query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { authorize } from "./access";
import { command as commandValidator, LIMITS, type CellValue } from "./model";
import { templateColumns, defaultView } from "./templates";
import {
  fail,
  key,
  text,
  columnsValid,
  validValue,
  convertValue,
  viewsValid,
  rowBudget,
} from "./validation";

export const watch = query({
  args: { ticket: v.string(), selectedKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth)
      return { status: "expired" as const, lists: [], list: null, rows: [] };
    const lists = await ctx.db
      .query("list_catalog")
      .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
      .collect();
    const selected = args.selectedKey
      ? lists.find((list) => list.key === args.selectedKey)
      : lists.find((list) => !list.archived);
    const list = selected ? await ctx.db.get(selected.list_id) : null;
    const rows = list
      ? await ctx.db
          .query("list_rows")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .collect()
      : [];
    return {
      status: "ready" as const,
      lists: lists.map(({ key, name, icon, archived, revision, favorite }) => ({
        key,
        name,
        icon,
        archived,
        revision,
        favorite: favorite ?? false,
      })),
      list: list
        ? {
            key: list.key,
            name: list.name,
            icon: list.icon,
            description: list.description,
            columns: list.columns,
            views: list.views,
            revision: list.revision,
            archived: list.archived,
            favorite: list.favorite ?? false,
          }
        : null,
      rows: rows
        .map(
          ({
            key,
            cells,
            versions,
            icon,
            notes,
            meta_version,
            position,
            archived,
            created_at,
            updated_at,
          }) => ({
            key,
            cells,
            versions,
            icon,
            notes,
            metaVersion: meta_version,
            position,
            archived,
            createdAt: created_at,
            updatedAt: updated_at,
          }),
        )
        .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key)),
    };
  },
});

export const apply = mutation({
  args: { ticket: v.string(), opId: v.string(), command: commandValidator },
  handler: async (ctx, args) => {
    const auth = await authorize(ctx, args.ticket);
    if (!auth) fail("UNAUTHORIZED");
    key(args.opId);
    const receipt = await ctx.db
      .query("list_operations")
      .withIndex("by_user_op", (q) =>
        q.eq("user_id", auth.user._id).eq("op_id", args.opId),
      )
      .first();
    if (receipt) {
      if (receipt.space_id !== auth.space._id) fail();
      return { ok: true };
    }
    const cmd = args.command;
    const now = Date.now();
    if (cmd.kind === "createList") {
      key(cmd.key);
      text(cmd.name, 100, true);
      text(cmd.icon, 24);
      const exists = await ctx.db
        .query("space_lists")
        .withIndex("by_space_key", (q) =>
          q.eq("space_id", auth.space._id).eq("key", cmd.key),
        )
        .first();
      if (exists) fail("DUPLICATE_NAME");
      if (
        (
          await ctx.db
            .query("list_catalog")
            .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
            .take(LIMITS.lists)
        ).length >= LIMITS.lists
      )
        fail("LIMIT_REACHED");
      let columns = templateColumns(cmd.template, cmd.locale);
      if (cmd.imported) {
        if (
          !cmd.imported.headers.length ||
          cmd.imported.headers.length > LIMITS.columns ||
          cmd.imported.rows.length > LIMITS.rows
        )
          fail("LIMIT_REACHED");
        columns = cmd.imported.headers.map((name, i) => ({
          id: "column-" + i,
          name: text(name, 60, true),
          type: i === 0 ? "title" : "text",
          icon: "",
          width: i === 0 ? 280 : 180,
          options: [],
          archived: false,
        }));
      }
      columnsValid(columns);
      const listId = await ctx.db.insert("space_lists", {
        space_id: auth.space._id,
        key: cmd.key,
        name: cmd.name.trim(),
        description: "",
        icon: cmd.icon,
        columns,
        views: [defaultView(cmd.locale)],
        revision: 1,
        archived: false,
        created_at: now,
        updated_at: now,
      });
      await ctx.db.insert("list_catalog", {
        space_id: auth.space._id,
        list_id: listId,
        key: cmd.key,
        name: cmd.name.trim(),
        icon: cmd.icon,
        archived: false,
        revision: 1,
      });
      if (cmd.imported)
        for (const [index, values] of cmd.imported.rows.entries()) {
          if (values.length !== columns.length) fail("IMPORT_ERROR");
          const cells: Record<string, CellValue> = {};
          columns.forEach((column, i) => {
            cells[column.id] = validValue(column, values[i]!);
          });
          rowBudget(cells);
          await ctx.db.insert("list_rows", {
            space_id: auth.space._id,
            list_id: listId,
            key: "import-" + index,
            cells,
            versions: {},
            icon: "",
            notes: "",
            meta_version: 0,
            position: (index + 1) * 1024,
            archived: false,
            created_at: now,
            updated_at: now,
          });
        }
    } else {
      key(cmd.listKey);
      const list = await ctx.db
        .query("space_lists")
        .withIndex("by_space_key", (q) =>
          q.eq("space_id", auth.space._id).eq("key", cmd.listKey),
        )
        .first();
      if (!list) fail("NOT_FOUND");
      if (
        list.archived &&
        cmd.kind !== "archiveList" &&
        cmd.kind !== "deleteList"
      )
        fail("ARCHIVED");
      if (cmd.kind === "deleteList") {
        if (cmd.baseRevision !== list.revision) fail("CONFLICT");
        for (const item of await ctx.db
          .query("list_rows")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .collect())
          await ctx.db.delete(item._id);
        for (const item of await ctx.db
          .query("list_catalog")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .collect())
          await ctx.db.delete(item._id);
        await ctx.db.delete(list._id);
        await ctx.db.insert("list_operations", {
          user_id: auth.user._id,
          space_id: auth.space._id,
          op_id: args.opId,
          created_at: now,
        });
        return { ok: true };
      }
      const rowsCache = new Map<string, Doc<"list_rows">>();
      const row = async (rowKey: string, allowArchived = false) => {
        key(rowKey);
        let value = rowsCache.get(rowKey);
        if (!value) {
          value =
            (await ctx.db
              .query("list_rows")
              .withIndex("by_list_key", (q) =>
                q.eq("list_id", list._id).eq("key", rowKey),
              )
              .first()) ?? undefined;
          if (value) rowsCache.set(rowKey, value);
        }
        if (
          !value ||
          value.space_id !== auth.space._id ||
          (!allowArchived && value.archived)
        )
          fail("NOT_FOUND");
        return value;
      };
      if ("baseRevision" in cmd && cmd.baseRevision !== list.revision)
        fail("CONFLICT");
      if (cmd.kind === "updateList") {
        if (cmd.name !== undefined) text(cmd.name, 100, true);
        if (cmd.description !== undefined) text(cmd.description, 1000);
        if (cmd.icon !== undefined) text(cmd.icon, 24);
        await ctx.db.patch(list._id, {
          ...(cmd.name !== undefined ? { name: cmd.name.trim() } : {}),
          ...(cmd.description !== undefined
            ? { description: cmd.description }
            : {}),
          ...(cmd.icon !== undefined ? { icon: cmd.icon } : {}),
          ...(cmd.favorite !== undefined ? { favorite: cmd.favorite } : {}),
          revision: list.revision + 1,
          updated_at: now,
        });
      } else if (cmd.kind === "duplicateList") {
        key(cmd.key);
        text(cmd.name, 100, true);
        const existing = await ctx.db
          .query("space_lists")
          .withIndex("by_space_key", (q) =>
            q.eq("space_id", auth.space._id).eq("key", cmd.key),
          )
          .first();
        if (existing) fail("DUPLICATE_NAME");
        const catalog = await ctx.db
          .query("list_catalog")
          .withIndex("by_space", (q) => q.eq("space_id", auth.space._id))
          .take(LIMITS.lists);
        if (catalog.length >= LIMITS.lists) fail("LIMIT_REACHED");
        const listId = await ctx.db.insert("space_lists", {
          space_id: list.space_id,
          key: cmd.key,
          name: cmd.name.trim(),
          description: list.description,
          icon: list.icon,
          columns: list.columns,
          views: list.views,
          revision: 1,
          archived: false,
          favorite: false,
          created_at: now,
          updated_at: now,
        });
        await ctx.db.insert("list_catalog", {
          space_id: list.space_id,
          list_id: listId,
          key: cmd.key,
          name: cmd.name.trim(),
          icon: list.icon,
          revision: 1,
          archived: false,
          favorite: false,
        });
        for (const item of await ctx.db
          .query("list_rows")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .collect()) {
          await ctx.db.insert("list_rows", {
            space_id: list.space_id,
            list_id: listId,
            key: item.key,
            cells: item.cells,
            versions: {},
            icon: item.icon,
            notes: item.notes,
            meta_version: 0,
            position: item.position,
            archived: item.archived,
            created_at: now,
            updated_at: now,
          });
        }
      } else if (cmd.kind === "archiveList")
        await ctx.db.patch(list._id, {
          archived: cmd.archived,
          revision: list.revision + 1,
          updated_at: now,
        });
      else if (cmd.kind === "setColumns") {
        columnsValid(cmd.columns, list.columns);
        const changed = cmd.columns.filter((next) => {
          const old = list.columns.find((c) => c.id === next.id);
          return (
            old &&
            !next.archived &&
            (old.type !== next.type ||
              JSON.stringify(old.options) !== JSON.stringify(next.options))
          );
        });
        if (changed.length)
          for (const item of await ctx.db
            .query("list_rows")
            .withIndex("by_list", (q) => q.eq("list_id", list._id))
            .collect()) {
            const cells = { ...item.cells },
              versions = { ...item.versions };
            for (const next of changed) {
              if (cells[next.id] !== undefined) {
                cells[next.id] = convertValue(
                  list.columns.find((c) => c.id === next.id)!,
                  next,
                  cells[next.id]!,
                );
                versions[next.id] = (versions[next.id] ?? 0) + 1;
              }
            }
            rowBudget(cells, item.notes, versions);
            await ctx.db.patch(item._id, { cells, versions, updated_at: now });
          }
        const active = new Set(
          cmd.columns.filter((c) => !c.archived).map((c) => c.id),
        );
        const views = list.views.map((view) => ({
          ...view,
          hidden: view.hidden.filter((id) => active.has(id)),
          filters: view.filters.filter((filter) => {
            const next = cmd.columns.find(
                (c) => c.id === filter.columnId && !c.archived,
              ),
              old = list.columns.find((c) => c.id === filter.columnId);
            if (!next || !old || next.type !== old.type) return false;
            if (["contains", "empty", "notEmpty"].includes(filter.operator))
              return true;
            try {
              validValue(next, filter.value);
              return true;
            } catch {
              return false;
            }
          }),
          sorts: view.sorts.filter((sort) => active.has(sort.columnId)),
          calculations: Object.fromEntries(
            Object.entries(view.calculations ?? {}).filter(
              ([id, calculation]) =>
                active.has(id) &&
                (!changed.some((c) => c.id === id) ||
                  ["none", "count"].includes(calculation)),
            ),
          ),
          groupBy: active.has(view.groupBy) ? view.groupBy : "",
        }));
        await ctx.db.patch(list._id, {
          columns: cmd.columns,
          views,
          revision: list.revision + 1,
          updated_at: now,
        });
      } else if (cmd.kind === "setViews") {
        viewsValid(cmd.views, list.columns);
        await ctx.db.patch(list._id, {
          views: cmd.views,
          revision: list.revision + 1,
          updated_at: now,
        });
      } else if (cmd.kind === "addRows") {
        if (!cmd.rows.length || cmd.rows.length > LIMITS.rows)
          fail("LIMIT_REACHED");
        const all = await ctx.db
          .query("list_rows")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .collect();
        if (all.length + cmd.rows.length > LIMITS.rows) fail("LIMIT_REACHED");
        const keys = new Set(all.map((row) => row.key));
        const ordered = all.sort(
          (a, b) => a.position - b.position || a.key.localeCompare(b.key),
        );
        const after = cmd.afterKey
          ? ordered.findIndex(
              (row) => row.key === cmd.afterKey && !row.archived,
            )
          : -1;
        if (cmd.afterKey && after < 0) fail("NOT_FOUND");
        // Rebalance before inserting a batch so repeated duplicates never exhaust fractional space.
        if (cmd.afterKey)
          for (const [i, item] of ordered.entries()) {
            item.position = (i + 1) * 1024;
            await ctx.db.patch(item._id, { position: item.position });
          }
        let position = cmd.afterKey
          ? ordered[after]!.position
          : Math.max(0, ...all.map((row) => row.position));
        const step =
          cmd.afterKey && ordered[after + 1]
            ? (ordered[after + 1]!.position - position) / (cmd.rows.length + 1)
            : 1024;
        for (const input of cmd.rows) {
          key(input.key);
          if (keys.has(input.key)) fail();
          keys.add(input.key);
          if (input.icon) text(input.icon, 24);
          if (input.notes) text(input.notes, 8000);
          const cells: Record<string, CellValue> = {};
          for (const [id, value] of Object.entries(input.cells)) {
            const column =
              list.columns.find((col) => col.id === id && !col.archived) ??
              fail();
            cells[id] = validValue(column, value);
          }
          rowBudget(cells, input.notes);
          position += step;
          await ctx.db.insert("list_rows", {
            space_id: auth.space._id,
            list_id: list._id,
            key: input.key,
            cells,
            versions: {},
            icon: input.icon ?? "",
            notes: input.notes ?? "",
            meta_version: 0,
            position,
            archived: false,
            created_at: now,
            updated_at: now,
          });
        }
      } else if (cmd.kind === "setCells") {
        if (!cmd.changes.length || cmd.changes.length > 1000)
          fail("LIMIT_REACHED");
        const seen = new Set<string>();
        for (const change of cmd.changes) {
          const pair = change.rowKey + ":" + change.columnId;
          if (seen.has(pair)) fail();
          seen.add(pair);
          const item = await row(change.rowKey);
          const column =
            list.columns.find((c) => c.id === change.columnId && !c.archived) ??
            fail("NOT_FOUND");
          const value = validValue(column, change.value);
          if (
            !Number.isSafeInteger(change.baseVersion) ||
            change.baseVersion < 0
          )
            fail();
          if (
            (item.versions[column.id] ?? 0) !== change.baseVersion &&
            JSON.stringify(item.cells[column.id] ?? null) !==
              JSON.stringify(value)
          )
            fail("CONFLICT");
          item.cells = { ...item.cells, [column.id]: value };
          item.versions = {
            ...item.versions,
            [column.id]: (item.versions[column.id] ?? 0) + 1,
          };
          rowBudget(item.cells, item.notes, item.versions);
        }
        for (const item of rowsCache.values())
          await ctx.db.patch(item._id, {
            cells: item.cells,
            versions: item.versions,
            updated_at: now,
          });
      } else if (cmd.kind === "setRow") {
        const item = await row(cmd.rowKey);
        if (cmd.baseVersion !== item.meta_version) fail("CONFLICT");
        if (cmd.icon !== undefined) text(cmd.icon, 24);
        if (cmd.notes !== undefined) text(cmd.notes, 8000);
        rowBudget(item.cells, cmd.notes ?? item.notes, item.versions);
        await ctx.db.patch(item._id, {
          ...(cmd.icon !== undefined ? { icon: cmd.icon } : {}),
          ...(cmd.notes !== undefined ? { notes: cmd.notes } : {}),
          meta_version: item.meta_version + 1,
          updated_at: now,
        });
      } else if (cmd.kind === "archiveRows") {
        if (
          !cmd.rowKeys.length ||
          cmd.rowKeys.length > 1000 ||
          new Set(cmd.rowKeys).size !== cmd.rowKeys.length
        )
          fail();
        for (const rowKey of cmd.rowKeys) {
          const item = await row(rowKey, true);
          await ctx.db.patch(item._id, {
            archived: cmd.archived,
            updated_at: now,
          });
        }
      } else if (cmd.kind === "deleteRows") {
        if (
          !cmd.rowKeys.length ||
          cmd.rowKeys.length > 1000 ||
          new Set(cmd.rowKeys).size !== cmd.rowKeys.length
        )
          fail();
        for (const rowKey of cmd.rowKeys) {
          const item = await row(rowKey, true);
          await ctx.db.delete(item._id);
        }
      } else if (cmd.kind === "moveRow") {
        const item = await row(cmd.rowKey);
        const all = (
          await ctx.db
            .query("list_rows")
            .withIndex("by_list", (q) => q.eq("list_id", list._id))
            .collect()
        )
          .filter((r) => !r.archived && r.key !== item.key)
          .sort(
            (a, b) => a.position - b.position || a.key.localeCompare(b.key),
          );
        let index = all.length;
        if (cmd.beforeKey) {
          index = all.findIndex((r) => r.key === cmd.beforeKey);
          if (index < 0) fail();
        } else if (cmd.afterKey) {
          index = all.findIndex((r) => r.key === cmd.afterKey);
          if (index < 0) fail();
          index++;
        }
        let left = all[index - 1]?.position,
          right = all[index]?.position;
        if (
          left !== undefined &&
          right !== undefined &&
          right - left < 0.00001
        ) {
          for (const [i, r] of all.entries()) {
            r.position = (i + 1) * 1024;
            await ctx.db.patch(r._id, { position: r.position });
          }
          left = all[index - 1]?.position;
          right = all[index]?.position;
        }
        await ctx.db.patch(item._id, {
          position:
            left === undefined
              ? (right ?? 1024) - 1024
              : right === undefined
                ? left + 1024
                : (left + right) / 2,
          updated_at: now,
        });
      }
      if (
        ![
          "updateList",
          "archiveList",
          "setColumns",
          "setViews",
          "duplicateList",
        ].includes(cmd.kind)
      )
        await ctx.db.patch(list._id, { updated_at: now });
      if ("baseRevision" in cmd && cmd.kind !== "duplicateList") {
        const summary = await ctx.db
          .query("list_catalog")
          .withIndex("by_list", (q) => q.eq("list_id", list._id))
          .first();
        const next = {
          space_id: list.space_id,
          list_id: list._id,
          key: list.key,
          name:
            cmd.kind === "updateList" && cmd.name !== undefined
              ? cmd.name.trim()
              : list.name,
          icon:
            cmd.kind === "updateList" && cmd.icon !== undefined
              ? cmd.icon
              : list.icon,
          archived: cmd.kind === "archiveList" ? cmd.archived : list.archived,
          revision: list.revision + 1,
          favorite:
            cmd.kind === "updateList" && cmd.favorite !== undefined
              ? cmd.favorite
              : (list.favorite ?? false),
        };
        if (summary) await ctx.db.patch(summary._id, next);
        else await ctx.db.insert("list_catalog", next);
      }
    }
    await ctx.db.insert("list_operations", {
      user_id: auth.user._id,
      space_id: auth.space._id,
      op_id: args.opId,
      created_at: now,
    });
    return { ok: true };
  },
});
