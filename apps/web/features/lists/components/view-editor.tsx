"use client";
import { SelectField, SelectOptionItem } from "./list-select";
import { ListGlyph } from "./list-icon";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ListData, ListView, ListCommand, CellValue } from "../types";
import { Modal } from "./overlays";
import { CellEditor } from "./cell-editor";
export function ViewEditor({
  list,
  view,
  mode,
  onClose,
  send,
  onSelect,
}: {
  list: ListData;
  view?: ListView;
  mode: "view" | "filter" | "sort";
  onClose: () => void;
  send: (command: ListCommand) => unknown;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("lists");
  const base = useRef(list.revision);
  const [draft, setDraft] = useState<ListView>(() =>
    view
      ? structuredClone(view)
      : {
          id: crypto.randomUUID(),
          name: t("defaultView", { n: list.views.length + 1 }),
          hidden: [],
          filters: [],
          sorts: [],
          groupBy: "",
          wrap: false,
        },
  );
  const columns = list.columns.filter((col) => !col.archived);
  const apply = (next: ListView, replace = true) => {
    send({
      kind: "setViews",
      listKey: list.key,
      baseRevision: base.current,
      views:
        replace && view
          ? list.views.map((item) => (item.id === view.id ? next : item))
          : [...list.views, next],
    });
    onSelect(next.id);
    onClose();
  };
  return (
    <Modal
      label={t(
        mode === "filter"
          ? "filter"
          : mode === "sort"
            ? "sort"
            : view
              ? "editView"
              : "addView",
      )}
      wide
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            draft.name.trim() &&
            !event.currentTarget.querySelector('[aria-invalid="true"]')
          )
            apply(draft);
        }}
      >
        <header className="lists-modal-heading">
          <h2>
            {t(
              mode === "filter"
                ? "filter"
                : mode === "sort"
                  ? "sort"
                  : view
                    ? "editView"
                    : "addView",
            )}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("close")}>
            <ListGlyph name="close" />
          </button>
        </header>
        {mode === "view" && (
          <label className="lists-form-label">
            {t("viewName")}
            <input
              autoFocus
              className="lists-field"
              value={draft.name}
              maxLength={60}
              required
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
        )}
        {mode !== "sort" && (
          <section className="lists-view-section">
            <SelectField
              aria-label={t("filterMode")}
              value={draft.filterMode ?? "all"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  filterMode: event.target.value as "all" | "any",
                })
              }
            >
              <SelectOptionItem value="all">{t("filterAll")}</SelectOptionItem>
              <SelectOptionItem value="any">{t("filterAny")}</SelectOptionItem>
            </SelectField>
            {draft.filters.map((filter, index) => {
              const column =
                columns.find((col) => col.id === filter.columnId) ??
                columns[0]!;
              const patch = (value: Partial<typeof filter>) =>
                setDraft({
                  ...draft,
                  filters: draft.filters.map((item, i) =>
                    i === index ? { ...item, ...value } : item,
                  ),
                });
              return (
                <div className="lists-filter-row" key={index}>
                  <SelectField
                    className="lists-field"
                    aria-label={t("property")}
                    value={filter.columnId}
                    onChange={(event) => {
                      const col = columns.find(
                        (col) => col.id === event.target.value,
                      )!;
                      patch({
                        columnId: col.id,
                        operator:
                          col.type === "text" || col.type === "title"
                            ? "contains"
                            : "equals",
                        value: col.type === "checkbox" ? false : null,
                      });
                    }}
                  >
                    {columns.map((col) => (
                      <SelectOptionItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectOptionItem>
                    ))}
                  </SelectField>
                  <SelectField
                    className="lists-field"
                    aria-label={t("operator")}
                    value={filter.operator}
                    onChange={(event) =>
                      patch({
                        operator: event.target.value as typeof filter.operator,
                      })
                    }
                  >
                    {[
                      "equals",
                      "notEquals",
                      "empty",
                      "notEmpty",
                      ...([
                        "title",
                        "text",
                        "url",
                        "email",
                        "phone",
                        "select",
                        "multiSelect",
                        "status",
                      ].includes(column.type)
                        ? ["contains"]
                        : []),
                      ...([
                        "number",
                        "currency",
                        "percent",
                        "rating",
                        "date",
                      ].includes(column.type)
                        ? ["gt", "lt"]
                        : []),
                    ].map((op) => (
                      <SelectOptionItem key={op} value={op}>
                        {t(`operators.${op}`)}
                      </SelectOptionItem>
                    ))}
                  </SelectField>
                  {!["empty", "notEmpty"].includes(filter.operator) &&
                    (filter.operator === "contains" ? (
                      <input
                        className="lists-field"
                        aria-label={t("filterValue")}
                        value={String(filter.value ?? "")}
                        onChange={(event) =>
                          patch({ value: event.target.value })
                        }
                      />
                    ) : (
                      <div className="lists-filter-cell">
                        <CellEditor
                          column={column}
                          value={filter.value}
                          label={t("filterValue")}
                          onChange={(value: CellValue) => patch({ value })}
                        />
                      </div>
                    ))}
                  <button
                    type="button"
                    className="lists-icon-button"
                    aria-label={t("removeFilter")}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        filters: draft.filters.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <ListGlyph name="close" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="lists-text-button"
              disabled={draft.filters.length >= 12}
              onClick={() =>
                setDraft({
                  ...draft,
                  filters: [
                    ...draft.filters,
                    {
                      columnId: columns[0]!.id,
                      operator: ["title", "text", "url"].includes(
                        columns[0]!.type,
                      )
                        ? "contains"
                        : "equals",
                      value:
                        columns[0]!.type === "checkbox"
                          ? false
                          : ["title", "text", "url"].includes(columns[0]!.type)
                            ? ""
                            : null,
                    },
                  ],
                })
              }
            >
              {t("addFilter")}
            </button>
          </section>
        )}
        {mode !== "filter" && (
          <section className="lists-view-section">
            <h3>{t("sort")}</h3>
            {draft.sorts.map((sort, index) => (
              <div className="lists-sort-row" key={index}>
                <SelectField
                  className="lists-field"
                  aria-label={t("property")}
                  value={sort.columnId}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sorts: draft.sorts.map((item, i) =>
                        i === index
                          ? { ...item, columnId: event.target.value }
                          : item,
                      ),
                    })
                  }
                >
                  {columns.map((col) => (
                    <SelectOptionItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectOptionItem>
                  ))}
                </SelectField>
                <SelectField
                  className="lists-field"
                  aria-label={t("direction")}
                  value={sort.direction}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sorts: draft.sorts.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              direction: event.target.value as "asc" | "desc",
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <SelectOptionItem value="asc">
                    {t("ascending")}
                  </SelectOptionItem>
                  <SelectOptionItem value="desc">
                    {t("descending")}
                  </SelectOptionItem>
                </SelectField>
                <button
                  type="button"
                  className="lists-icon-button"
                  aria-label={t("moveSortUp")}
                  disabled={!index}
                  onClick={() => {
                    const sorts = [...draft.sorts];
                    [sorts[index - 1], sorts[index]] = [
                      sorts[index]!,
                      sorts[index - 1]!,
                    ];
                    setDraft({ ...draft, sorts });
                  }}
                >
                  <ListGlyph name="up" />
                </button>
                <button
                  type="button"
                  className="lists-icon-button"
                  aria-label={t("removeSort")}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sorts: draft.sorts.filter((_, i) => i !== index),
                    })
                  }
                >
                  <ListGlyph name="close" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="lists-text-button"
              disabled={draft.sorts.length >= 5}
              onClick={() =>
                setDraft({
                  ...draft,
                  sorts: [
                    ...draft.sorts,
                    { columnId: columns[0]!.id, direction: "asc" },
                  ],
                })
              }
            >
              {t("addSort")}
            </button>
          </section>
        )}
        {mode === "view" && (
          <section className="lists-view-section">
            <label className="lists-form-label">
              {t("groupBy")}
              <SelectField
                aria-label={t("groupBy")}
                className="lists-field"
                value={draft.groupBy}
                onChange={(event) =>
                  setDraft({ ...draft, groupBy: event.target.value })
                }
              >
                <SelectOptionItem value="">{t("noGrouping")}</SelectOptionItem>
                {columns.map((col) => (
                  <SelectOptionItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectOptionItem>
                ))}
              </SelectField>
            </label>
            <label className="lists-check-label">
              <input
                type="checkbox"
                checked={draft.wrap}
                onChange={(event) =>
                  setDraft({ ...draft, wrap: event.target.checked })
                }
              />
              {t("wrapCells")}
            </label>
          </section>
        )}
        <footer className="lists-modal-actions">
          {view && mode === "view" && (
            <>
              <button
                type="button"
                className="lists-danger"
                disabled={list.views.length === 1}
                onClick={() => {
                  send({
                    kind: "setViews",
                    listKey: list.key,
                    baseRevision: base.current,
                    views: list.views.filter((item) => item.id !== view.id),
                  });
                  onSelect(list.views.find((item) => item.id !== view.id)!.id);
                  onClose();
                }}
              >
                {t("deleteView")}
              </button>
              <button
                type="button"
                className="lists-secondary"
                disabled={list.views.length >= 12}
                onClick={() =>
                  apply(
                    {
                      ...draft,
                      id: crypto.randomUUID(),
                      name: t("copyName", { name: draft.name }).slice(0, 60),
                    },
                    false,
                  )
                }
              >
                {t("duplicate")}
              </button>
            </>
          )}
          <button type="submit" className="lists-primary">
            {t("apply")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
