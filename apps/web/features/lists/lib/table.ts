import type { CellValue, ListColumn, ListRow, ListView } from "../types";
export function displayValue(
  value: CellValue | undefined,
  column: ListColumn,
  locale = "es",
): string {
  if (column.type === "checkbox" && value == null) value = false;
  if (value === null || value === undefined) return "";
  if (Array.isArray(value))
    return value
      .map(
        (id) => column.options.find((option) => option.id === id)?.label ?? id,
      )
      .join(", ");
  if (column.type === "select" || column.type === "status")
    return (
      column.options.find((option) => option.id === value)?.label ??
      String(value)
    );
  if (column.type === "checkbox")
    return value
      ? locale === "en"
        ? "Yes"
        : "Sí"
      : locale === "en"
        ? "No"
        : "No";
  if (column.type === "currency" && typeof value === "number")
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: column.currency ?? "USD",
      currencyDisplay: "code",
    }).format(value);
  if (column.type === "percent" && typeof value === "number")
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(value / 100);
  if (column.type === "rating" && typeof value === "number")
    return value + "/5";
  return String(value);
}
export function visibleRows(
  rows: ListRow[],
  columns: ListColumn[],
  view: ListView,
  query: string,
  locale: string,
) {
  const find = (id: string) => columns.find((column) => column.id === id);
  const compare = (
    a: CellValue | undefined,
    b: CellValue | undefined,
    column: ListColumn,
  ) => {
    if (a === null || a === undefined || a === "")
      return b === null || b === undefined || b === "" ? 0 : 1;
    if (b === null || b === undefined || b === "") return -1;
    if (["number", "currency", "percent", "rating"].includes(column.type))
      return Number(a) - Number(b);
    if (column.type === "checkbox") return Number(a) - Number(b);
    if (column.type === "select" || column.type === "status")
      return (
        column.options.findIndex((o) => o.id === a) -
        column.options.findIndex((o) => o.id === b)
      );
    return displayValue(a, column, locale).localeCompare(
      displayValue(b, column, locale),
      locale,
      { numeric: true, sensitivity: "base" },
    );
  };
  return rows
    .filter(
      (row) =>
        !row.archived &&
        (!query ||
          columns.some((column) =>
            displayValue(row.cells[column.id], column, locale)
              .toLocaleLowerCase(locale)
              .includes(query.toLocaleLowerCase(locale)),
          )) &&
        (view.filterMode === "any" && view.filters.length
          ? view.filters.some.bind(view.filters)
          : view.filters.every.bind(view.filters))((filter) => {
          const column = find(filter.columnId);
          if (!column) return true;
          const value =
            column.type === "checkbox"
              ? (row.cells[column.id] ?? false)
              : row.cells[column.id];
          const empty =
            value === null ||
            value === undefined ||
            value === "" ||
            (Array.isArray(value) && !value.length);
          if (filter.operator === "empty") return empty;
          if (filter.operator === "notEmpty") return !empty;
          if (filter.operator === "contains")
            return displayValue(value, column, locale)
              .toLocaleLowerCase(locale)
              .includes(String(filter.value ?? "").toLocaleLowerCase(locale));
          if (filter.operator === "equals" || filter.operator === "notEquals") {
            const equal = Array.isArray(value)
              ? JSON.stringify([...value].sort()) ===
                JSON.stringify(
                  Array.isArray(filter.value)
                    ? [...filter.value].sort()
                    : filter.value,
                )
              : JSON.stringify(value ?? null) === JSON.stringify(filter.value);
            return filter.operator === "equals" ? equal : !equal;
          }
          if (empty || filter.value === null || filter.value === "")
            return false;
          const result = compare(value, filter.value, column);
          return filter.operator === "gt" ? result > 0 : result < 0;
        }),
    )
    .sort((a, b) => {
      for (const sort of view.sorts) {
        const column = find(sort.columnId);
        if (!column) continue;
        const av =
          column.type === "checkbox"
            ? (a.cells[column.id] ?? false)
            : a.cells[column.id];
        const bv =
          column.type === "checkbox"
            ? (b.cells[column.id] ?? false)
            : b.cells[column.id];
        const empty = (value: CellValue | undefined) =>
          value == null ||
          value === "" ||
          (Array.isArray(value) && !value.length);
        if (empty(av) !== empty(bv)) return empty(av) ? 1 : -1;
        const result = compare(av, bv, column);
        if (result) return sort.direction === "asc" ? result : -result;
      }
      return a.position - b.position || a.key.localeCompare(b.key);
    });
}
export function exportCsv(
  rows: ListRow[],
  columns: ListColumn[],
  locale: string,
) {
  const escape = (value: string) =>
    '"' +
    (/^[=+@\t\r-]/.test(value) ? "'" + value : value).replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      columns.map((c) => escape(c.name)).join(","),
      ...rows.map((row) =>
        columns
          .map((column) =>
            escape(displayValue(row.cells[column.id], column, locale)),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function parseCsv(input: string): {
  headers: string[];
  rows: string[][];
} {
  const text = input.replace(/^\uFEFF/, "");
  if (text.length > 2_000_000) throw Error("IMPORT_ERROR");
  const result: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length) throw Error("IMPORT_ERROR");
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.length)) result.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw Error("IMPORT_ERROR");
  row.push(cell);
  if (row.some((value) => value.length)) result.push(row);
  const headers = result.shift();
  if (
    !headers?.length ||
    headers.length > 40 ||
    new Set(headers.map((value) => value.trim().toLowerCase())).size !==
      headers.length ||
    headers.some((value) => !value.trim() || value.length > 60) ||
    result.length > 1000 ||
    result.some(
      (row) =>
        row.length !== headers.length ||
        row.some((value) => value.length > 2000),
    )
  )
    throw Error("IMPORT_ERROR");
  return { headers: headers.map((value) => value.trim()), rows: result };
}
