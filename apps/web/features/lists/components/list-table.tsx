"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import type {
  CellValue,
  ListColumn,
  ListCommand,
  ListData,
  ListRow,
  ListView,
} from "../types";
import { displayValue } from "../lib/table";
import { ListIcon, PropertyIcon, ListGlyph } from "./list-icon";
import { CellEditor } from "./cell-editor";
import { Popover } from "./overlays";
import { BulkEditor } from "./bulk-editor";
import { CalculationCell } from "./calculation-cell";
import { DeleteDialog } from "./delete-dialog";

type Gesture = {
  kind: "column" | "row";
  key: string;
  startX: number;
  startY: number;
  label: string;
  base: number;
  slot: number;
  moved: boolean;
};
export function ListTable({
  list,
  rows,
  allRows,
  view,
  send,
  onEditColumn,
  onOpenRow,
  onAddRow,
  onArchive,
  readOnly = false,
  trash = false,
  onError,
}: {
  list: ListData;
  rows: ListRow[];
  allRows: ListRow[];
  view: ListView;
  send: (command: ListCommand) => unknown;
  onEditColumn: (column: ListColumn) => void;
  onOpenRow: (key: string) => void;
  onAddRow: () => void;
  onArchive: (keys: string[], archived: boolean) => void;
  readOnly?: boolean;
  trash?: boolean;
  onError: (code: string) => void;
}) {
  const t = useTranslations("lists");
  const locale = useLocale();
  const table = useRef<HTMLTableElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const skipClick = useRef(false);
  const [ghost, setGhost] = useState<{
    label: string;
    x: number;
    y: number;
    slot: number;
    kind: string;
  } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const menuAnchor = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [bulkEdit, setBulkEdit] = useState(false);
  const [deleteRow, setDeleteRow] = useState<ListRow | null>(null);
  const lastSelected = useRef<string | null>(null);
  const selectPageRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSelected(new Set());
    setPage(0);
    setRowMenu(null);
    setCollapsed(new Set());
    setBulkEdit(false);
    lastSelected.current = null;
  }, [list.key]);
  useEffect(() => {
    const media = matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const columns = list.columns
    .filter((column) => !column.archived && !view.hidden.includes(column.id))
    .sort((a, b) =>
      compact ? Number(b.type === "title") - Number(a.type === "title") : 0,
    );
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  useEffect(() => {
    if (selectPageRef.current)
      selectPageRef.current.indeterminate =
        pageRows.some((row) => selected.has(row.key)) &&
        !pageRows.every((row) => selected.has(row.key));
  }, [pageRows, selected]);
  const ordered = !view.sorts.length && !view.groupBy && !trash && !readOnly;
  useEffect(() => {
    setPage(0);
  }, [view.id]);
  useEffect(() => {
    const keys = new Set(rows.map((row) => row.key));
    setSelected((previous) => {
      const next = new Set([...previous].filter((key) => keys.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);
  const groups = useMemo(() => {
    if (!view.groupBy) return [["", pageRows]] as [string, ListRow[]][];
    const column = list.columns.find((column) => column.id === view.groupBy);
    if (!column) return [["", pageRows]] as [string, ListRow[]][];
    const result = new Map<string, ListRow[]>();
    for (const row of pageRows) {
      const label =
        displayValue(row.cells[column.id], column, locale) || t("emptyGroup");
      result.set(label, [...(result.get(label) ?? []), row]);
    }
    return [...result.entries()];
  }, [view.groupBy, list.columns, pageRows, locale, t]);
  const groupCounts = useMemo(() => {
    const column = list.columns.find((column) => column.id === view.groupBy),
      counts = new Map<string, number>();
    if (column)
      for (const row of rows) {
        const label =
          displayValue(row.cells[column.id], column, locale) || t("emptyGroup");
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    return counts;
  }, [view.groupBy, list.columns, rows, locale, t]);
  const setColumns = (next: ListColumn[], base = list.revision) =>
    send({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: base,
      columns: next,
    });
  const moveColumn = (id: string, delta: number) => {
    const active = list.columns.filter((column) => !column.archived);
    const index = active.findIndex((column) => column.id === id),
      target = index + delta;
    if (target < 0 || target >= active.length) return;
    [active[index], active[target]] = [active[target]!, active[index]!];
    setColumns([
      ...active,
      ...list.columns.filter((column) => column.archived),
    ]);
  };
  const start = (
    event: React.PointerEvent<HTMLButtonElement>,
    kind: "column" | "row",
    key: string,
    label: string,
  ) => {
    if (readOnly || (kind === "row" && !ordered) || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      key,
      label,
      startX: event.clientX,
      startY: event.clientY,
      base: list.revision,
      slot: 0,
      moved: false,
    };
  };
  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6
    )
      return;
    drag.moved = true;
    const nodes = Array.from(
      table.current?.querySelectorAll<HTMLElement>(
        drag.kind === "column" ? "th[data-column]" : "tr[data-row-key]",
      ) ?? [],
    );
    const coordinate = drag.kind === "column" ? event.clientX : event.clientY;
    let slot = nodes.findIndex((node) => {
      const rect = node.getBoundingClientRect();
      return (
        coordinate <
        (drag.kind === "column"
          ? rect.left + rect.width / 2
          : rect.top + rect.height / 2)
      );
    });
    if (slot < 0) slot = nodes.length;
    drag.slot = slot;
    setGhost({
      label: drag.label,
      x: event.clientX + 12,
      y: event.clientY + 12,
      slot,
      kind: drag.kind,
    });
  };
  const finish = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    gesture.current = null;
    setGhost(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag?.moved) return;
    skipClick.current = true;
    if (drag.kind === "column") {
      const visible = [...columns];
      const source = visible.findIndex((column) => column.id === drag.key);
      let slot = drag.slot;
      if (source < slot) slot--;
      const [moving] = visible.splice(source, 1);
      if (moving) visible.splice(slot, 0, moving);
      const active = list.columns.filter((column) => !column.archived);
      const reordered = active.map((column) =>
        view.hidden.includes(column.id) ? column : visible.shift()!,
      );
      setColumns(
        [...reordered, ...list.columns.filter((column) => column.archived)],
        drag.base,
      );
    } else {
      const source = pageRows.findIndex((row) => row.key === drag.key);
      let slot = drag.slot;
      if (source < slot) slot--;
      const others = pageRows.filter((row) => row.key !== drag.key);
      const before = others[slot],
        after = others[slot - 1];
      send({
        kind: "moveRow",
        listKey: list.key,
        rowKey: drag.key,
        ...(before
          ? { beforeKey: before.key }
          : after
            ? { afterKey: after.key }
            : {}),
      });
    }
  };
  const resize = (
    event: React.PointerEvent<HTMLButtonElement>,
    column: ListColumn,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const control = event.currentTarget;
    control.setPointerCapture(event.pointerId);
    const startX = event.clientX,
      startWidth = widths[column.id] ?? column.width,
      base = list.revision;
    let width = startWidth;
    const motion = (event: PointerEvent) => {
      width = Math.round(
        Math.min(600, Math.max(80, startWidth + event.clientX - startX)),
      );
      setWidths((previous) => ({ ...previous, [column.id]: width }));
    };
    const end = (event: PointerEvent) => {
      control.removeEventListener("pointermove", motion);
      control.removeEventListener("pointerup", end);
      control.removeEventListener("pointercancel", cancel);
      if (control.hasPointerCapture(event.pointerId))
        control.releasePointerCapture(event.pointerId);
      if (width !== startWidth)
        setColumns(
          list.columns.map((col) =>
            col.id === column.id ? { ...col, width } : col,
          ),
          base,
        );
      setWidths((previous) => {
        const next = { ...previous };
        delete next[column.id];
        return next;
      });
    };
    const cancel = () => {
      control.removeEventListener("pointermove", motion);
      control.removeEventListener("pointerup", end);
      control.removeEventListener("pointercancel", cancel);
      setWidths({});
    };
    control.addEventListener("pointermove", motion);
    control.addEventListener("pointerup", end);
    control.addEventListener("pointercancel", cancel);
  };
  const setCell = (
    row: ListRow,
    column: ListColumn,
    value: CellValue,
    baseVersion: number,
  ) => {
    if (JSON.stringify(row.cells[column.id] ?? null) === JSON.stringify(value))
      return;
    send({
      kind: "setCells",
      listKey: list.key,
      changes: [{ rowKey: row.key, columnId: column.id, value, baseVersion }],
    });
  };
  const createOption = (column: ListColumn, label: string) => {
    const id = crypto.randomUUID();
    setColumns(
      list.columns.map((col) =>
        col.id === column.id
          ? {
              ...col,
              options: [
                ...col.options,
                { id, label: label.slice(0, 60), color: "gray" },
              ],
            }
          : col,
      ),
    );
    return id;
  };
  const keyboard = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (
      !event.altKey ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    )
      return;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>(
      "td[data-column-id]",
    );
    if (!cell) return;
    const row = cell.parentElement as HTMLTableRowElement;
    const r = pageRows.findIndex((item) => item.key === row.dataset.rowKey),
      c = columns.findIndex((item) => item.id === cell.dataset.columnId);
    const nextR =
        r + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0),
      nextC =
        c +
        (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0);
    const target = table.current?.querySelector<HTMLElement>(
      `tr[data-row-key="${pageRows[nextR]?.key}"] td[data-column-id="${columns[nextC]?.id}"] input,tr[data-row-key="${pageRows[nextR]?.key}"] td[data-column-id="${columns[nextC]?.id}"] button`,
    );
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };
  const paste = (event: React.ClipboardEvent) => {
    if (readOnly || trash) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>(
      "td[data-column-id]",
    );
    if (!cell) return;
    event.preventDefault();
    const start = rows.findIndex(
        (row) => row.key === cell.parentElement?.dataset.rowKey,
      ),
      startColumn = columns.findIndex(
        (column) => column.id === cell.dataset.columnId,
      );
    const values = text
      .replace(/\r\n/g, "\n")
      .replace(/\n$/, "")
      .split("\n")
      .map((row) => row.split("\t"));
    if (
      values.reduce((count, row) => count + row.length, 0) > 500 ||
      values.some((row) => row.length > columns.length - startColumn) ||
      start + values.length > rows.length
    ) {
      onError("PASTE_BOUNDS");
      return;
    }
    try {
      const changes: Extract<ListCommand, { kind: "setCells" }>["changes"] = [];
      values.forEach((cells, i) =>
        cells.forEach((text, j) => {
          const row = rows[start + i]!,
            column = columns[startColumn + j]!;
          let value: CellValue = text;
          if (
            ["number", "currency", "percent", "rating"].includes(column.type)
          ) {
            value = text.trim() ? Number(text) : null;
            if (value !== null && !Number.isFinite(value)) throw Error();
          } else if (column.type === "checkbox") {
            if (!["true", "false", "1", "0", ""].includes(text.toLowerCase()))
              throw Error();
            value = text === "1" || text.toLowerCase() === "true";
          } else if (
            ["select", "status", "multiSelect"].includes(column.type)
          ) {
            const match = (label: string) =>
              column.options.find(
                (option) =>
                  option.label.toLowerCase() === label.trim().toLowerCase() ||
                  option.id === label,
              )?.id ??
              (() => {
                throw Error();
              })();
            value = text
              ? column.type === "multiSelect"
                ? text.split(",").map(match)
                : match(text)
              : null;
          }
          changes.push({
            rowKey: row.key,
            columnId: column.id,
            value,
            baseVersion: row.versions[column.id] ?? 0,
          });
        }),
      );
      send({ kind: "setCells", listKey: list.key, changes });
    } catch {
      onError("PASTE_INVALID");
    }
  };
  const menuRow = allRows.find((row) => row.key === rowMenu);
  return (
    <div className="lists-grid-area">
      {selected.size > 0 && (
        <div className="lists-selection-bar" role="status">
          <span>{t("selectedCount", { count: selected.size })}</span>
          {!trash && !readOnly && (
            <>
              <button
                className="lists-text-button"
                onClick={() => setBulkEdit(true)}
              >
                {t("bulkEdit")}
              </button>
              <button
                className="lists-text-button"
                disabled={allRows.length + selected.size > 1000}
                onClick={() => {
                  send({
                    kind: "addRows",
                    listKey: list.key,
                    rows: rows
                      .filter((row) => selected.has(row.key))
                      .map((row) => ({
                        key: crypto.randomUUID(),
                        cells: row.cells,
                        icon: row.icon,
                        notes: row.notes,
                      })),
                  });
                  setSelected(new Set());
                }}
              >
                {t("duplicateSelected")}
              </button>
            </>
          )}
          {rows.length > pageRows.length && selected.size < rows.length && (
            <button
              className="lists-text-button"
              onClick={() => setSelected(new Set(rows.map((row) => row.key)))}
            >
              {t("selectAllMatches", { count: rows.length })}
            </button>
          )}
          <button
            className="lists-text-button"
            onClick={() => {
              onArchive([...selected], !trash);
              setSelected(new Set());
            }}
          >
            {t(trash ? "restore" : "archiveSelected")}
          </button>
          <button
            className="lists-text-button"
            onClick={() => setSelected(new Set())}
          >
            {t("clearSelection")}
          </button>
        </div>
      )}
      {bulkEdit && (
        <BulkEditor
          list={list}
          rows={rows.filter((row) => selected.has(row.key))}
          send={send}
          onClose={() => setBulkEdit(false)}
        />
      )}
      <div
        className="lists-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={list.name}
      >
        <table
          ref={table}
          className={`lists-table ${view.wrap ? "lists-wrap" : ""}`}
          style={{
            width: columns.reduce(
              (sum, col) => sum + (widths[col.id] ?? col.width),
              76,
            ),
          }}
          onKeyDown={keyboard}
          onPaste={paste}
        >
          <caption className="sr-only">{list.name}</caption>
          <colgroup>
            <col style={{ width: 44 }} />
            {columns.map((column) => (
              <col
                key={column.id}
                style={{ width: widths[column.id] ?? column.width }}
              />
            ))}
            <col style={{ width: 32 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="lists-row-select">
                <input
                  ref={selectPageRef}
                  disabled={readOnly}
                  type="checkbox"
                  aria-label={t("selectPage")}
                  checked={
                    pageRows.length > 0 &&
                    pageRows.every((row) => selected.has(row.key))
                  }
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(pageRows.map((row) => row.key))
                        : new Set(),
                    )
                  }
                />
              </th>
              {columns.map((column, index) => (
                <th
                  key={column.id}
                  data-column={column.id}
                  data-drop={ghost?.kind === "column" && ghost.slot === index}
                >
                  <div className="lists-column-heading">
                    <button
                      type="button"
                      className="lists-column-grip"
                      title={t("dragColumn")}
                      aria-label={t("dragNamedColumn", { name: column.name })}
                      disabled={
                        readOnly ||
                        trash ||
                        (compact && column.type === "title")
                      }
                      onPointerDown={(event) =>
                        start(event, "column", column.id, column.name)
                      }
                      onPointerMove={move}
                      onPointerUp={finish}
                      onPointerCancel={() => {
                        gesture.current = null;
                        setGhost(null);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.altKey &&
                          (event.key === "ArrowLeft" ||
                            event.key === "ArrowRight")
                        ) {
                          event.preventDefault();
                          moveColumn(
                            column.id,
                            event.key === "ArrowLeft" ? -1 : 1,
                          );
                        }
                      }}
                    >
                      <ListGlyph name="grip" />
                    </button>
                    <button
                      type="button"
                      className="lists-column-name"
                      disabled={readOnly || trash}
                      onClick={() => onEditColumn(column)}
                    >
                      {column.icon ? (
                        <ListIcon name={column.icon} />
                      ) : (
                        <PropertyIcon type={column.type} />
                      )}
                      <span>{column.name}</span>
                    </button>
                    <button
                      type="button"
                      className="lists-resize"
                      role="separator"
                      aria-label={t("resizeColumn", { name: column.name })}
                      aria-orientation="vertical"
                      aria-valuemin={80}
                      aria-valuemax={600}
                      aria-valuenow={widths[column.id] ?? column.width}
                      disabled={readOnly || trash}
                      onPointerDown={(event) => resize(event, column)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ArrowLeft" ||
                          event.key === "ArrowRight"
                        ) {
                          event.preventDefault();
                          setColumns(
                            list.columns.map((col) =>
                              col.id === column.id
                                ? {
                                    ...col,
                                    width: Math.max(
                                      80,
                                      Math.min(
                                        600,
                                        col.width +
                                          (event.key === "ArrowLeft"
                                            ? -16
                                            : 16),
                                      ),
                                    ),
                                  }
                                : col,
                            ),
                          );
                        }
                      }}
                    />
                  </div>
                </th>
              ))}
              <th aria-label={t("rowActions")} />
            </tr>
          </thead>
          {groups.map(([label, items]) => (
            <tbody key={label || "all"}>
              {view.groupBy && (
                <tr className="lists-group-heading">
                  <th colSpan={columns.length + 2}>
                    <button
                      onClick={() =>
                        setCollapsed((previous) => {
                          const next = new Set(previous);
                          if (next.has(label)) next.delete(label);
                          else next.add(label);
                          return next;
                        })
                      }
                      aria-expanded={!collapsed.has(label)}
                    >
                      <ListGlyph
                        name={collapsed.has(label) ? "right" : "down"}
                      />
                      {label}
                      <span>{groupCounts.get(label) ?? items.length}</span>
                    </button>
                  </th>
                </tr>
              )}
              {!collapsed.has(label) &&
                items.map((row) => (
                  <tr
                    key={row.key}
                    data-row-key={row.key}
                    data-selected={selected.has(row.key)}
                  >
                    <td className="lists-row-select">
                      <div>
                        <button
                          className="lists-row-grip"
                          title={ordered ? t("dragRow") : t("manualOrderHint")}
                          aria-label={t("rowActions")}
                          onPointerDown={(event) =>
                            start(
                              event,
                              "row",
                              row.key,
                              displayValue(
                                row.cells[
                                  list.columns.find(
                                    (col) => col.type === "title",
                                  )!.id
                                ],
                                list.columns.find(
                                  (col) => col.type === "title",
                                )!,
                                locale,
                              ) || t("untitledRow"),
                            )
                          }
                          onPointerMove={move}
                          onPointerUp={finish}
                          onPointerCancel={() => {
                            gesture.current = null;
                            setGhost(null);
                          }}
                          onClick={(event) => {
                            if (skipClick.current) {
                              skipClick.current = false;
                              return;
                            }
                            menuAnchor.current = event.currentTarget;
                            setRowMenu(row.key);
                          }}
                        >
                          <ListGlyph name="grip" />
                        </button>
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          aria-label={t("selectRow", {
                            name: String(
                              row.cells[
                                list.columns.find(
                                  (col) => col.type === "title",
                                )!.id
                              ] || t("untitledRow"),
                            ),
                          })}
                          checked={selected.has(row.key)}
                          onChange={(event) =>
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (
                                (event.nativeEvent as MouseEvent).shiftKey &&
                                lastSelected.current
                              ) {
                                const start = rows.findIndex(
                                    (item) => item.key === lastSelected.current,
                                  ),
                                  end = rows.findIndex(
                                    (item) => item.key === row.key,
                                  );
                                if (start >= 0 && end >= 0)
                                  for (const item of rows.slice(
                                    Math.min(start, end),
                                    Math.max(start, end) + 1,
                                  )) {
                                    if (event.target.checked)
                                      next.add(item.key);
                                    else next.delete(item.key);
                                  }
                              }
                              if (event.target.checked) next.add(row.key);
                              else next.delete(row.key);
                              lastSelected.current = row.key;
                              return next;
                            })
                          }
                        />
                      </div>
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} data-column-id={column.id}>
                        <div className="lists-cell-inner">
                          {column.type === "title" && row.icon && (
                            <ListIcon name={row.icon} />
                          )}
                          <CellEditor
                            onEditOptions={
                              readOnly || trash
                                ? undefined
                                : () => onEditColumn(column)
                            }
                            wrap={view.wrap}
                            column={column}
                            value={row.cells[column.id]}
                            version={row.versions[column.id] ?? 0}
                            disabled={readOnly || trash}
                            label={column.name}
                            onChange={(value, base) =>
                              setCell(row, column, value, base)
                            }
                            onCreateOption={
                              readOnly || trash
                                ? undefined
                                : (label) => createOption(column, label)
                            }
                          />
                          {column.type === "title" && (
                            <button
                              className="lists-open-row"
                              aria-label={t("openRow")}
                              onClick={() => onOpenRow(row.key)}
                            >
                              <ListGlyph name="open" />
                            </button>
                          )}
                        </div>
                      </td>
                    ))}
                    <td>
                      {trash && (
                        <button
                          className="lists-icon-button"
                          aria-label={t("restore")}
                          onClick={() => onArchive([row.key], false)}
                        >
                          <ListGlyph name="undo" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
          <tfoot>
            {!trash && !readOnly && (
              <tr>
                <td colSpan={columns.length + 2}>
                  <button className="lists-add-row" onClick={onAddRow}>
                    <ListGlyph name="plus" />
                    {t("newRow")}
                  </button>
                </td>
              </tr>
            )}
            <tr className="lists-calculations">
              <td />
              {columns.map((column) => (
                <td key={column.id}>
                  <CalculationCell
                    column={column}
                    list={list}
                    view={view}
                    rows={rows}
                    send={send}
                    disabled={readOnly || trash}
                  />
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
        {!rows.length && (
          <div className="lists-empty-table">
            <p>
              {t(
                trash
                  ? "emptyTrash"
                  : view.filters.length
                    ? "noMatchingRows"
                    : "emptyTable",
              )}
            </p>
            {!trash && !readOnly && (
              <button className="lists-text-button" onClick={onAddRow}>
                {t("addFirstRow")}
              </button>
            )}
          </div>
        )}
      </div>
      {pageCount > 1 && (
        <nav className="lists-pagination" aria-label={t("pagination")}>
          <span>
            {t("range", {
              from: pageIndex * pageSize + 1,
              to: Math.min((pageIndex + 1) * pageSize, rows.length),
              total: rows.length,
            })}
          </span>
          <button disabled={!pageIndex} onClick={() => setPage(pageIndex - 1)}>
            {t("previous")}
          </button>
          <button
            disabled={pageIndex >= pageCount - 1}
            onClick={() => setPage(pageIndex + 1)}
          >
            {t("next")}
          </button>
        </nav>
      )}
      {ghost &&
        createPortal(
          <div
            className="lists-surface lists-drag-ghost"
            style={{ left: ghost.x, top: ghost.y }}
          >
            {ghost.label}
          </div>,
          document.body,
        )}
      {deleteRow && (
        <DeleteDialog
          name={String(
            deleteRow.cells[list.columns.find((c) => c.type === "title")!.id] ??
              t("untitledRow"),
          )}
          onClose={() => setDeleteRow(null)}
          onDelete={() =>
            send({
              kind: "deleteRows",
              listKey: list.key,
              rowKeys: [deleteRow.key],
            })
          }
        />
      )}
      {menuRow && (
        <Popover
          anchor={menuAnchor}
          label={t("rowActions")}
          onClose={() => setRowMenu(null)}
        >
          <button
            className="lists-menu-button"
            onClick={() => {
              onOpenRow(menuRow.key);
              setRowMenu(null);
            }}
          >
            {t("openRow")}
          </button>
          {!readOnly && !trash && (
            <button
              className="lists-menu-button"
              onClick={() => {
                const active = new Set(
                  list.columns
                    .filter((col) => !col.archived)
                    .map((col) => col.id),
                );
                send({
                  kind: "addRows",
                  listKey: list.key,
                  afterKey: menuRow.key,
                  rows: [
                    {
                      key: crypto.randomUUID(),
                      cells: Object.fromEntries(
                        Object.entries(menuRow.cells).filter(([id]) =>
                          active.has(id),
                        ),
                      ),
                      icon: menuRow.icon,
                      notes: menuRow.notes,
                    },
                  ],
                });
                setRowMenu(null);
              }}
            >
              {t("duplicate")}
            </button>
          )}
          {!readOnly && (
            <button
              className="lists-menu-button lists-danger"
              onClick={() => {
                onArchive([menuRow.key], !trash);
                setRowMenu(null);
              }}
            >
              {t(trash ? "restore" : "archiveRow")}
            </button>
          )}
          {ordered && (
            <>
              <button
                className="lists-menu-button"
                onClick={() => {
                  const index = rows.findIndex(
                    (row) => row.key === menuRow.key,
                  );
                  if (index > 0)
                    send({
                      kind: "moveRow",
                      listKey: list.key,
                      rowKey: menuRow.key,
                      beforeKey: rows[index - 1]!.key,
                    });
                  setRowMenu(null);
                }}
              >
                {t("moveUp")}
              </button>
              <button
                className="lists-menu-button"
                onClick={() => {
                  const index = rows.findIndex(
                    (row) => row.key === menuRow.key,
                  );
                  if (index < rows.length - 1)
                    send({
                      kind: "moveRow",
                      listKey: list.key,
                      rowKey: menuRow.key,
                      afterKey: rows[index + 1]!.key,
                    });
                  setRowMenu(null);
                }}
              >
                {t("moveDown")}
              </button>
            </>
          )}
          {!readOnly && (
            <button
              className="lists-menu-button lists-danger"
              onClick={() => {
                setDeleteRow(menuRow);
                setRowMenu(null);
              }}
            >
              {t("deleteRow")}
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}
