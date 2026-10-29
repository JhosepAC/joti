"use client";
import { useLocale, useTranslations } from "next-intl";
import type {
  ListColumn,
  ListData,
  ListView,
  ListRow,
  ListCommand,
} from "../types";
import { ListSelect } from "./list-select";
export function CalculationCell({
  column,
  list,
  view,
  rows,
  send,
  disabled = false,
}: {
  column: ListColumn;
  list: ListData;
  view: ListView;
  rows: ListRow[];
  send: (command: ListCommand) => unknown;
  disabled?: boolean;
}) {
  const t = useTranslations("lists"),
    locale = useLocale(),
    numeric = ["number", "currency", "percent", "rating"].includes(column.type);
  const kind =
    view.calculations?.[column.id] ??
    (column.type === "title"
      ? "count"
      : numeric
        ? "sum"
        : column.type === "checkbox"
          ? "checked"
          : "none");
  const values = rows.map((row) => row.cells[column.id]),
    numbers = values.filter((v): v is number => typeof v === "number");
  const count = values.filter(
    (value) =>
      value != null && value !== "" && (!Array.isArray(value) || value.length),
  ).length;
  const result =
    kind === "count"
      ? column.type === "title" && !view.calculations?.[column.id]
        ? rows.length
        : count
      : kind === "checked"
        ? values.filter((v) => v === true).length
        : kind === "sum"
          ? numbers.reduce((a, b) => a + b, 0)
          : kind === "average"
            ? numbers.length
              ? numbers.reduce((a, b) => a + b, 0) / numbers.length
              : null
            : kind === "min"
              ? numbers.length
                ? Math.min(...numbers)
                : null
              : kind === "max"
                ? numbers.length
                  ? Math.max(...numbers)
                  : null
                : null;
  const formatted =
    result === null
      ? "—"
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(
          result,
        );
  const kinds = [
    "none",
    "count",
    ...(numeric ? ["sum", "average", "min", "max"] : []),
    ...(column.type === "checkbox" ? ["checked"] : []),
  ];
  return (
    <ListSelect
      label={t("calculate", { name: column.name })}
      className="lists-calculation-select"
      searchable={false}
      disabled={disabled}
      value={kind}
      display={
        <span className="lists-calculation-value">
          {kind !== "none" && <small>{t(`calculationKinds.${kind}`)}</small>}
          <strong>{formatted}</strong>
        </span>
      }
      options={kinds.map((value) => ({
        value,
        label: t(`calculationKinds.${value}`),
      }))}
      onChange={(kind) =>
        send({
          kind: "setViews",
          listKey: list.key,
          baseRevision: list.revision,
          views: list.views.map((item) =>
            item.id === view.id
              ? {
                  ...item,
                  calculations: {
                    ...item.calculations,
                    [column.id]: kind as NonNullable<
                      ListView["calculations"]
                    >[string],
                  },
                }
              : item,
          ),
        })
      }
    />
  );
}
