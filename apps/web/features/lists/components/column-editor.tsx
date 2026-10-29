"use client";
import { SelectField, SelectOptionItem } from "./list-select";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ListColumn, ListData, ListCommand } from "../types";
import { Modal } from "./overlays";
import { PropertyIcon, ListGlyph } from "./list-icon";
const TYPES = [
  "text",
  "number",
  "checkbox",
  "select",
  "multiSelect",
  "status",
  "date",
  "url",
  "email",
  "phone",
  "currency",
  "percent",
  "rating",
] as const;
const COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
];
export function ColumnEditor({
  list,
  column,
  onClose,
  send,
}: {
  list: ListData;
  column?: ListColumn;
  onClose: () => void;
  send: (command: ListCommand) => unknown;
}) {
  const t = useTranslations("lists");
  const base = useRef(list.revision);
  const [draft, setDraft] = useState<ListColumn>(() =>
    column
      ? structuredClone(column)
      : {
          id: crypto.randomUUID(),
          name: "",
          icon: "",
          type: "text",
          width: 180,
          options: [],
          archived: false,
        },
  );
  const [error, setError] = useState("");
  const save = () => {
    if (
      !draft.name.trim() ||
      list.columns.some(
        (col) =>
          col.id !== draft.id &&
          !col.archived &&
          col.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
      )
    ) {
      setError(t("errors.DUPLICATE_NAME"));
      return;
    }
    if (
      new Set(draft.options.map((option) => option.label.trim().toLowerCase()))
        .size !== draft.options.length ||
      draft.options.some((option) => !option.label.trim())
    ) {
      setError(t("errors.DUPLICATE_NAME"));
      return;
    }
    const columns = column
      ? list.columns.map((col) => (col.id === draft.id ? draft : col))
      : [...list.columns, draft];
    send({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: base.current,
      columns,
    });
    onClose();
  };
  return (
    <Modal label={t(column ? "editProperty" : "addProperty")} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <header className="lists-modal-heading">
          <h2>{t(column ? "editProperty" : "addProperty")}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")}>
            <ListGlyph name="close" />
          </button>
        </header>
        <label className="lists-form-label">
          {t("propertyName")}
          <input
            autoFocus
            className="lists-field"
            maxLength={60}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            required
          />
        </label>
        <div className="lists-form-grid">
          <label className="lists-form-label">
            {t("propertyType")}
            <SelectField
              aria-label={t("propertyType")}
              className="lists-field"
              value={draft.type}
              disabled={draft.type === "title"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as ListColumn["type"],
                })
              }
            >
              {draft.type === "title" && (
                <SelectOptionItem value="title">
                  {t("types.title")}
                </SelectOptionItem>
              )}
              {TYPES.map((type) => (
                <SelectOptionItem
                  key={type}
                  value={type}
                  icon={<PropertyIcon type={type} />}
                >
                  {t(`types.${type}`)}
                </SelectOptionItem>
              ))}
            </SelectField>
          </label>
          <label className="lists-form-label">
            {t("customIcon")}
            <input
              className="lists-field"
              maxLength={24}
              value={draft.icon}
              placeholder={t("optional")}
              onChange={(event) =>
                setDraft({ ...draft, icon: event.target.value })
              }
            />
          </label>
        </div>
        {draft.type === "currency" && (
          <label className="lists-form-label">
            {t("currencyUnit")}
            <SelectField
              aria-label={t("currencyUnit")}
              value={draft.currency ?? "USD"}
              onChange={(event) =>
                setDraft({ ...draft, currency: event.target.value })
              }
            >
              {[
                "USD",
                "EUR",
                "PEN",
                "COP",
                "MXN",
                "ARS",
                "CLP",
                "BRL",
                "GBP",
                "JPY",
              ].map((currency) => (
                <SelectOptionItem key={currency} value={currency}>
                  {currency}
                </SelectOptionItem>
              ))}
            </SelectField>
          </label>
        )}
        <label className="lists-form-label">
          {t("width", { value: Math.round(draft.width) })}
          <input
            type="range"
            min={80}
            max={600}
            value={draft.width}
            onChange={(event) =>
              setDraft({ ...draft, width: Number(event.target.value) })
            }
          />
        </label>
        {["select", "multiSelect", "status"].includes(draft.type) && (
          <section className="lists-options-editor">
            <h3>{t("options")}</h3>
            {draft.options
              .filter((option) => !option.archived)
              .map((option) => (
                <div key={option.id}>
                  <input
                    aria-label={t("optionName")}
                    className="lists-field"
                    maxLength={60}
                    value={option.label}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        options: draft.options.map((item) =>
                          item.id === option.id
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <SelectField
                    aria-label={t("optionColor")}
                    value={option.color}
                    className={`lists-field lists-color-${option.color}`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        options: draft.options.map((item) =>
                          item.id === option.id
                            ? { ...item, color: event.target.value }
                            : item,
                        ),
                      })
                    }
                  >
                    {COLORS.map((color) => (
                      <SelectOptionItem key={color} value={color}>
                        {t(`colors.${color}`)}
                      </SelectOptionItem>
                    ))}
                  </SelectField>
                  <button
                    type="button"
                    className="lists-icon-button"
                    aria-label={t("removeOption", { name: option.label })}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        options: draft.options.map((item) =>
                          item.id === option.id
                            ? { ...item, archived: true }
                            : item,
                        ),
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
              disabled={draft.options.length >= 100}
              onClick={() =>
                setDraft({
                  ...draft,
                  options: [
                    ...draft.options,
                    {
                      id: crypto.randomUUID(),
                      label: t("defaultOption", {
                        n: draft.options.length + 1,
                      }),
                      color: "gray",
                    },
                  ],
                })
              }
            >
              {t("addOption")}
            </button>
            {draft.options.length >= 100 && (
              <p className="lists-hint">{t("optionLimit")}</p>
            )}
            {draft.options.some((option) => option.archived) && (
              <div className="lists-archived-options">
                <h4>{t("archivedOptions")}</h4>
                <p className="lists-hint">{t("archivedOptionsHint")}</p>
                {draft.options
                  .filter((option) => option.archived)
                  .map((option) => (
                    <div key={option.id}>
                      <span
                        className={`lists-chip lists-color-${option.color}`}
                      >
                        {option.label}
                      </span>
                      <button
                        type="button"
                        className="lists-text-button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            options: draft.options.map((item) =>
                              item.id === option.id
                                ? { ...item, archived: false }
                                : item,
                            ),
                          })
                        }
                      >
                        {t("restore")}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}
        <p className="lists-hint">{t("typeChangeHint")}</p>
        {error && (
          <p role="alert" className="lists-form-error">
            {error}
          </p>
        )}
        <footer className="lists-modal-actions">
          {column && column.type !== "title" && (
            <button
              type="button"
              className="lists-danger"
              onClick={() => {
                send({
                  kind: "setColumns",
                  listKey: list.key,
                  baseRevision: base.current,
                  columns: list.columns.map((col) =>
                    col.id === column.id ? { ...col, archived: true } : col,
                  ),
                });
                onClose();
              }}
            >
              {t("archiveProperty")}
            </button>
          )}
          <button type="submit" className="lists-primary">
            {t("apply")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function PropertyVisibility({
  list,
  viewId,
  send,
  onEdit,
}: {
  list: ListData;
  viewId: string;
  send: (command: ListCommand) => unknown;
  onEdit: (column?: ListColumn) => void;
}) {
  const t = useTranslations("lists");
  const view = list.views.find((view) => view.id === viewId) ?? list.views[0]!;
  const columns = list.columns.filter((col) => !col.archived);
  const move = (id: string, delta: number) => {
    const active = [...columns];
    const index = active.findIndex((col) => col.id === id),
      target = index + delta;
    if (target < 0 || target >= active.length) return;
    [active[index], active[target]] = [active[target]!, active[index]!];
    send({
      kind: "setColumns",
      listKey: list.key,
      baseRevision: list.revision,
      columns: [...active, ...list.columns.filter((col) => col.archived)],
    });
  };
  return (
    <div className="lists-properties-panel">
      <h3>{t("properties")}</h3>
      {columns.map((column, index) => (
        <div className="lists-property-row" key={column.id}>
          <label>
            <input
              type="checkbox"
              disabled={column.type === "title"}
              checked={!view.hidden.includes(column.id)}
              onChange={(event) =>
                send({
                  kind: "setViews",
                  listKey: list.key,
                  baseRevision: list.revision,
                  views: list.views.map((item) =>
                    item.id === view.id
                      ? {
                          ...item,
                          hidden: event.target.checked
                            ? item.hidden.filter((id) => id !== column.id)
                            : [...item.hidden, column.id],
                        }
                      : item,
                  ),
                })
              }
            />
            <PropertyIcon type={column.type} />
            <span>{column.name}</span>
          </label>
          <button
            type="button"
            className="lists-icon-button"
            aria-label={t("moveLeft", { name: column.name })}
            disabled={index === 0}
            onClick={() => move(column.id, -1)}
          >
            <ListGlyph name="up" />
          </button>
          <button
            type="button"
            className="lists-icon-button"
            aria-label={t("moveRight", { name: column.name })}
            disabled={index === columns.length - 1}
            onClick={() => move(column.id, 1)}
          >
            <ListGlyph name="down" />
          </button>
          <button
            className="lists-icon-button"
            onClick={() => onEdit(column)}
            aria-label={t("editNamedProperty", { name: column.name })}
          >
            <ListGlyph name="more" />
          </button>
        </div>
      ))}
      <button className="lists-menu-button" onClick={() => onEdit()}>
        {t("addProperty")}
      </button>
      {list.columns.some((col) => col.archived) && (
        <>
          <h3>{t("archivedProperties")}</h3>
          {list.columns
            .filter((col) => col.archived)
            .map((column) => (
              <div key={column.id} className="lists-property-row">
                <span>{column.name}</span>
                <button
                  className="lists-text-button"
                  onClick={() =>
                    send({
                      kind: "setColumns",
                      listKey: list.key,
                      baseRevision: list.revision,
                      columns: list.columns.map((col) =>
                        col.id === column.id
                          ? { ...col, archived: false }
                          : col,
                      ),
                    })
                  }
                >
                  {t("restore")}
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
