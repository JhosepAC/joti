import { ConvexError } from "convex/values";
import {
  COLORS,
  LIMITS,
  type CellValue,
  type ListColumn,
  type ListView,
} from "./model";
export function fail(code = "VALIDATION_ERROR"): never {
  throw new ConvexError({ code });
}
export function key(value: string) {
  if (
    !/^[A-Za-z0-9_-]{1,80}$/.test(value) ||
    ["__proto__", "constructor", "prototype"].includes(value)
  )
    fail();
  return value;
}
export function text(value: string, max: number, required = false) {
  if (
    value.length > max ||
    (required && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail();
  return value.trim();
}
export function columnsValid(
  columns: ListColumn[],
  previous: ListColumn[] = [],
) {
  if (
    columns.length > 80 ||
    columns.filter((c) => !c.archived).length > LIMITS.columns ||
    new TextEncoder().encode(JSON.stringify(columns)).byteLength > 256000
  )
    fail("LIMIT_REACHED");
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const col of columns) {
    key(col.id);
    text(col.name, 60, true);
    text(col.icon, 24);
    if (col.currency !== undefined && !/^[A-Z]{3}$/.test(col.currency)) fail();
    if (ids.has(col.id)) fail();
    ids.add(col.id);
    if (!col.archived) {
      const name = col.name.trim().toLowerCase();
      if (names.has(name)) fail("DUPLICATE_NAME");
      names.add(name);
    }
    if (
      !Number.isFinite(col.width) ||
      col.width < 80 ||
      col.width > 600 ||
      col.options.length > 100
    )
      fail();
    const options = new Set<string>();
    const labels = new Set<string>();
    for (const option of col.options) {
      key(option.id);
      text(option.label, 60, true);
      if (
        options.has(option.id) ||
        labels.has(option.label.toLowerCase()) ||
        !COLORS.includes(option.color)
      )
        fail();
      options.add(option.id);
      labels.add(option.label.toLowerCase());
    }
  }
  const title = columns.filter((c) => c.type === "title" && !c.archived);
  if (
    title.length !== 1 ||
    columns.filter((c) => c.type === "title").length !== 1
  )
    fail("TITLE_REQUIRED");
  const oldTitle = previous.find((c) => c.type === "title");
  if (oldTitle && oldTitle.id !== title[0]!.id) fail("TITLE_REQUIRED");
  if (previous.some((col) => !ids.has(col.id))) fail(); // Archive rather than destroy property data.
}
export function validValue(col: ListColumn, value: CellValue): CellValue {
  if (value === null) return col.type === "checkbox" ? false : null;
  if (col.type === "checkbox") {
    if (typeof value !== "boolean") fail();
    return value;
  }
  if (["number", "currency", "percent", "rating"].includes(col.type)) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      Math.abs(value) > 1e15
    )
      fail();
    if (
      col.type === "rating" &&
      (!Number.isInteger(value) || value < 0 || value > 5)
    )
      fail();
    if (col.type === "percent" && (value < 0 || value > 100)) fail();
    return value;
  }
  if (col.type === "multiSelect") {
    if (
      !Array.isArray(value) ||
      value.length > 100 ||
      new Set(value).size !== value.length ||
      value.some((id) => !col.options.some((o) => o.id === id))
    )
      fail();
    return value;
  }
  if (typeof value !== "string") fail();
  text(value, LIMITS.text);
  if (
    col.type === "email" &&
    value !== "" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  )
    fail();
  if (
    col.type === "phone" &&
    value !== "" &&
    (!/^[+\d\s().-]{3,40}$/.test(value) || value.replace(/\D/g, "").length < 3)
  )
    fail();
  if (
    (col.type === "select" || col.type === "status") &&
    value !== "" &&
    !col.options.some((o) => o.id === value)
  )
    fail();
  if (
    col.type === "date" &&
    value !== "" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
  )
    fail();
  if (col.type === "url" && value !== "") {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol)) fail();
    } catch {
      fail();
    }
  }
  return value;
}
export function convertValue(
  old: ListColumn,
  next: ListColumn,
  value: CellValue,
): CellValue {
  if (value === null || value === "" || (Array.isArray(value) && !value.length))
    return next.type === "checkbox" ? false : null;
  if (old.type === next.type) return validValue(next, value);
  try {
    const label = (id: string) =>
      old.options.find((o) => o.id === id)?.label ?? id;
    const raw = Array.isArray(value)
      ? value.map(label).join(", ")
      : old.type === "select" || old.type === "status"
        ? label(String(value))
        : String(value);
    if (
      next.type === "text" ||
      next.type === "title" ||
      next.type === "date" ||
      next.type === "url" ||
      next.type === "email" ||
      next.type === "phone"
    )
      return validValue(next, raw);
    if (["number", "currency", "percent", "rating"].includes(next.type))
      return validValue(next, Number(raw));
    if (next.type === "checkbox") {
      if (!["true", "false", "1", "0"].includes(raw.toLowerCase())) fail();
      return raw === "true" || raw === "1";
    }
    const find = (label: string) =>
      next.options.find(
        (o) =>
          o.label.toLowerCase() === label.trim().toLowerCase() ||
          o.id === label,
      )?.id ?? fail();
    return validValue(
      next,
      next.type === "multiSelect" ? raw.split(",").map(find) : find(raw),
    );
  } catch {
    fail("TYPE_CONVERSION");
  }
}
export function viewsValid(views: ListView[], columns: ListColumn[]) {
  if (!views.length || views.length > LIMITS.views) fail("LIMIT_REACHED");
  const ids = new Set<string>();
  const active = columns.filter((c) => !c.archived);
  const lookup = (id: string) => active.find((c) => c.id === id) ?? fail();
  for (const view of views) {
    key(view.id);
    text(view.name, 60, true);
    if (ids.has(view.id)) fail();
    ids.add(view.id);
    if (
      view.filters.length > 12 ||
      view.sorts.length > 5 ||
      new Set(view.hidden).size !== view.hidden.length
    )
      fail();
    for (const id of view.hidden)
      if (lookup(id).type === "title") fail("TITLE_REQUIRED");
    for (const sort of view.sorts) lookup(sort.columnId);
    for (const [id, calculation] of Object.entries(view.calculations ?? {})) {
      const column = lookup(id);
      if (
        ["sum", "average", "min", "max"].includes(calculation) &&
        !["number", "currency", "percent", "rating"].includes(column.type)
      )
        fail();
      if (calculation === "checked" && column.type !== "checkbox") fail();
    }
    if (view.groupBy) lookup(view.groupBy);
    for (const filter of view.filters) {
      const column = lookup(filter.columnId);
      if (
        ["gt", "lt"].includes(filter.operator) &&
        !["number", "currency", "percent", "rating", "date"].includes(
          column.type,
        )
      )
        fail();
      if (filter.operator === "contains") {
        if (typeof filter.value !== "string") fail();
        text(filter.value, 2000);
      } else if (!["empty", "notEmpty"].includes(filter.operator))
        validValue(column, filter.value);
    }
  }
}
export function rowBudget(
  cells: Record<string, CellValue>,
  notes = "",
  versions: Record<string, number> = {},
) {
  const bytes = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;
  // Bound the full query payload as well as an individual cell map (including UTF-8 text).
  if (bytes(cells) > 8000 || bytes({ cells, notes, versions }) > 12000)
    fail("LIMIT_REACHED");
}
