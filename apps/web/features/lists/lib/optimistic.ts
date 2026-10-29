import type { ListsSnapshot, ListCommand, ListRow } from "../types";
import { templateColumns, defaultView } from "@/convex/lists/templates";
export interface PendingOperation {
  opId: string;
  command: ListCommand;
  createdAt: number;
}
export function projectSnapshot(
  snapshot: ListsSnapshot,
  operations: PendingOperation[],
  selectedKey?: string,
): ListsSnapshot {
  if (snapshot.status !== "ready") return snapshot;
  const data = structuredClone(snapshot);
  if (selectedKey && data.list?.key !== selectedKey) {
    data.list = null;
    data.rows = [];
  }
  for (const { command: cmd, createdAt } of operations) {
    if (cmd.kind === "createList") {
      if (!data.lists.some((list) => list.key === cmd.key))
        data.lists.push({
          key: cmd.key,
          name: cmd.name,
          icon: cmd.icon,
          archived: false,
          revision: 1,
          favorite: false,
        });
      if (cmd.key === selectedKey && !data.list) {
        data.list = {
          key: cmd.key,
          name: cmd.name,
          icon: cmd.icon,
          description: "",
          columns: cmd.imported
            ? cmd.imported.headers.map((name, i) => ({
                id: "column-" + i,
                name: name.trim(),
                type: i === 0 ? "title" : "text",
                icon: "",
                width: i === 0 ? 280 : 180,
                options: [],
                archived: false,
              }))
            : templateColumns(cmd.template, cmd.locale),
          views: [defaultView(cmd.locale)],
          revision: 1,
          archived: false,
          favorite: false,
        };
        data.rows = cmd.imported
          ? cmd.imported.rows.map((values, i) => ({
              key: "import-" + i,
              cells: Object.fromEntries(
                values.map((value, j) => ["column-" + j, value]),
              ),
              versions: {},
              icon: "",
              notes: "",
              metaVersion: 0,
              position: (i + 1) * 1024,
              archived: false,
              createdAt,
              updatedAt: createdAt,
            }))
          : [];
      }
      continue;
    }
    const summary = data.lists.find((list) => list.key === cmd.listKey);
    if (cmd.kind === "deleteList") {
      data.lists = data.lists.filter((item) => item.key !== cmd.listKey);
      if (data.list?.key === cmd.listKey) {
        data.list = null;
        data.rows = [];
      }
      continue;
    }
    if (summary && cmd.kind === "updateList")
      Object.assign(summary, {
        ...(cmd.name !== undefined ? { name: cmd.name } : {}),
        ...(cmd.icon !== undefined ? { icon: cmd.icon } : {}),
        ...(cmd.favorite !== undefined ? { favorite: cmd.favorite } : {}),
      });
    if (summary && cmd.kind === "archiveList") summary.archived = cmd.archived;
    if (summary && "baseRevision" in cmd && cmd.kind !== "duplicateList")
      summary.revision = Math.max(summary.revision, cmd.baseRevision + 1);
    const list = data.list;
    if (!list || list.key !== cmd.listKey) continue;
    if (cmd.kind === "deleteRows")
      data.rows = data.rows.filter((row) => !cmd.rowKeys.includes(row.key));
    if (cmd.kind === "updateList")
      Object.assign(list, {
        ...(cmd.name !== undefined ? { name: cmd.name } : {}),
        ...(cmd.icon !== undefined ? { icon: cmd.icon } : {}),
        ...(cmd.description !== undefined
          ? { description: cmd.description }
          : {}),
        ...(cmd.favorite !== undefined ? { favorite: cmd.favorite } : {}),
      });
    if (cmd.kind === "archiveList") list.archived = cmd.archived;
    if (cmd.kind === "setColumns") list.columns = cmd.columns;
    if (cmd.kind === "setViews") list.views = cmd.views;
    if ("baseRevision" in cmd && cmd.kind !== "duplicateList")
      list.revision = Math.max(list.revision, cmd.baseRevision + 1);
    if (cmd.kind === "addRows") {
      const ordered = [...data.rows].sort((a, b) => a.position - b.position);
      const anchor = cmd.afterKey
        ? ordered.findIndex((row) => row.key === cmd.afterKey)
        : -1;
      let position =
        anchor >= 0
          ? ordered[anchor]!.position
          : Math.max(0, ...data.rows.map((row) => row.position));
      const nextPosition =
        anchor >= 0 ? ordered[anchor + 1]?.position : undefined;
      const step =
        nextPosition !== undefined
          ? (nextPosition - position) / (cmd.rows.length + 1)
          : 1024;
      for (const item of cmd.rows)
        if (!data.rows.some((row) => row.key === item.key)) {
          const row: ListRow = {
            key: item.key,
            cells: item.cells,
            versions: {},
            icon: item.icon ?? "",
            notes: item.notes ?? "",
            metaVersion: 0,
            position: (position += step),
            archived: false,
            createdAt,
            updatedAt: createdAt,
          };
          data.rows.push(row);
        }
    }
    if (cmd.kind === "setCells")
      for (const change of cmd.changes) {
        const row = data.rows.find((row) => row.key === change.rowKey);
        if (row) {
          row.cells[change.columnId] = change.value;
          row.versions[change.columnId] = Math.max(
            row.versions[change.columnId] ?? 0,
            change.baseVersion + 1,
          );
        }
      }
    if (cmd.kind === "setRow") {
      const row = data.rows.find((row) => row.key === cmd.rowKey);
      if (row) {
        if (cmd.icon !== undefined) row.icon = cmd.icon;
        if (cmd.notes !== undefined) row.notes = cmd.notes;
        row.metaVersion = Math.max(row.metaVersion, cmd.baseVersion + 1);
      }
    }
    if (cmd.kind === "archiveRows")
      for (const row of data.rows)
        if (cmd.rowKeys.includes(row.key)) row.archived = cmd.archived;
    if (cmd.kind === "moveRow") {
      const row = data.rows.find((row) => row.key === cmd.rowKey);
      const others = data.rows
        .filter((row) => row.key !== cmd.rowKey && !row.archived)
        .sort((a, b) => a.position - b.position);
      let index = others.length;
      if (cmd.beforeKey)
        index = others.findIndex((row) => row.key === cmd.beforeKey);
      else if (cmd.afterKey)
        index = others.findIndex((row) => row.key === cmd.afterKey) + 1;
      if (row && index >= 0) {
        const left = others[index - 1]?.position,
          right = others[index]?.position;
        row.position =
          left === undefined
            ? (right ?? 1024) - 1024
            : right === undefined
              ? left + 1024
              : (left + right) / 2;
      }
    }
  }
  return data;
}
