"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ListCommand, ListData, ListRow } from "../types";
import { Modal, Popover } from "./overlays";
import { LIST_ICONS, ListIcon, PropertyIcon, ListGlyph } from "./list-icon";
import { EditableText } from "./editable-text";
import { CellEditor } from "./cell-editor";
export function RenameDialog({
  name,
  onClose,
  onSave,
  maxLength = 100,
  error,
}: {
  name: string;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean | void> | boolean | void;
  maxLength?: number;
  error?: string;
}) {
  const t = useTranslations("lists"),
    [draft, setDraft] = useState(name),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <Modal label={t("rename")} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !draft.trim()) return;
          setBusy(true);
          setFailed(false);
          try {
            const saved = await onSave(draft.trim());
            if (saved === false) setFailed(true);
            else onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="lists-modal-heading">
          <h2>{t("rename")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <ListGlyph name="close" />
          </button>
        </header>
        <label className="lists-form-label">
          {t("itemName")}
          <input
            autoFocus
            className="lists-field"
            required
            maxLength={maxLength}
            value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        {(failed || error) && (
          <p className="lists-form-error" role="alert">
            {error || t("errors.UNAVAILABLE")}
          </p>
        )}
        <footer className="lists-modal-actions">
          <button type="button" className="lists-secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="submit"
            className="lists-primary"
            disabled={busy || !draft.trim()}
          >
            {t("saveName")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

export function IconPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const t = useTranslations("lists");
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const [custom, setCustom] = useState("");
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="lists-identity-icon"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ListIcon name={value || "table"} />
      </button>
      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div className="lists-icon-picker">
            {LIST_ICONS.map((icon) => (
              <button
                type="button"
                key={icon}
                aria-label={t(`icons.${icon}`)}
                aria-pressed={value === icon}
                onClick={() => {
                  onChange(icon);
                  setOpen(false);
                }}
              >
                <ListIcon name={icon} />
              </button>
            ))}
          </div>
          <div>
            <label className="lists-form-label">
              {t("customIcon")}
              <input
                className="lists-field"
                maxLength={24}
                value={custom}
                placeholder={t("iconPlaceholder")}
                onChange={(event) => setCustom(event.target.value)}
              />
            </label>
            <button
              className="lists-secondary"
              type="button"
              onClick={() => {
                if (custom.trim()) {
                  onChange(custom.trim());
                  setOpen(false);
                }
              }}
              disabled={!custom.trim()}
            >
              {t("useIcon")}
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}
export function InlineTitle({
  value,
  version,
  onChange,
  label,
}: {
  value: string;
  version: number;
  onChange: (value: string, base: number) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const base = useRef(version);
  const cancelled = useRef(false);
  const finish = () => {
    if (!cancelled.current && draft.trim() && draft.trim() !== value)
      onChange(draft.trim(), base.current);
    setEditing(false);
  };
  return (
    <h1 className="lists-title">
      {editing ? (
        <input
          autoFocus
          aria-label={label}
          value={draft}
          maxLength={100}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finish();
            } else if (event.key === "Escape") {
              cancelled.current = true;
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            cancelled.current = false;
            base.current = version;
            setDraft(value);
            setEditing(true);
          }}
        >
          {value}
        </button>
      )}
    </h1>
  );
}
export function NewListDialog({
  onClose,
  onCreate,
  initialTemplate = "tasks",
  imported,
  importName,
}: {
  onClose: () => void;
  onCreate: (command: Extract<ListCommand, { kind: "createList" }>) => void;
  initialTemplate?: "blank" | "tasks" | "shopping" | "packing";
  imported?: { headers: string[]; rows: string[][] };
  importName?: string;
}) {
  const t = useTranslations("lists");
  const locale = useLocale();
  const [template, setTemplate] = useState(initialTemplate);
  const [name, setName] = useState(
    importName?.slice(0, 100) ?? t(`templates.${initialTemplate}.name`),
  );
  const [icon, setIcon] = useState(
    initialTemplate === "shopping"
      ? "basket"
      : initialTemplate === "packing"
        ? "plane"
        : "table",
  );
  return (
    <Modal label={t("newList")} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          onCreate({
            kind: "createList",
            key: crypto.randomUUID(),
            name: name.trim(),
            icon,
            template,
            locale,
            ...(imported ? { imported } : {}),
          });
          onClose();
        }}
      >
        <header className="lists-modal-heading">
          <h2>{t(imported ? "importCsv" : "newList")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <ListGlyph name="close" />
          </button>
        </header>
        <div className="lists-create-title">
          <IconPicker value={icon} onChange={setIcon} label={t("changeIcon")} />
          <label className="lists-form-label">
            {t("listName")}
            <input
              autoFocus
              className="lists-field"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
        {!imported ? (
          <fieldset className="lists-template-choices">
            <legend>{t("startingPoint")}</legend>
            {(["tasks", "shopping", "packing", "blank"] as const).map((key) => (
              <label key={key} data-selected={template === key}>
                <input
                  type="radio"
                  name="listTemplate"
                  value={key}
                  checked={template === key}
                  onChange={() => {
                    setTemplate(key);
                    setName(t(`templates.${key}.name`));
                    setIcon(
                      key === "shopping"
                        ? "basket"
                        : key === "packing"
                          ? "plane"
                          : "table",
                    );
                  }}
                />
                <span>
                  <strong>{t(`templates.${key}.name`)}</strong>
                  <span>{t(`templates.${key}.description`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="lists-import-preview">
            <p>
              {t("importPreview", {
                rows: imported.rows.length,
                columns: imported.headers.length,
              })}
            </p>
            <p>{imported.headers.join(" · ")}</p>
            <p className="lists-hint">{t("importHint")}</p>
          </div>
        )}
        <footer className="lists-modal-actions">
          <button className="lists-secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="lists-primary"
            type="submit"
            disabled={!name.trim()}
          >
            {t("createList")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function RowDetail({
  list,
  row,
  onClose,
  send,
}: {
  list: ListData;
  row: ListRow;
  onClose: () => void;
  send: (command: ListCommand) => unknown;
}) {
  const t = useTranslations("lists");
  const locale = useLocale();
  const title = list.columns.find((column) => column.type === "title")!;
  const disabled = row.archived || list.archived;
  return (
    <Modal
      label={String(row.cells[title.id] || t("untitledRow"))}
      wide
      onClose={onClose}
    >
      <header className="lists-modal-heading">
        <h2>{t("rowDetail")}</h2>
        <button type="button" aria-label={t("close")} onClick={onClose}>
          <ListGlyph name="close" />
        </button>
      </header>
      {disabled && <p className="lists-notice">{t("archivedItem")}</p>}
      <div className="lists-row-detail-title">
        <IconPicker
          value={row.icon || "table"}
          label={t("changeRowIcon")}
          onChange={(icon) => {
            if (!disabled)
              send({
                kind: "setRow",
                listKey: list.key,
                rowKey: row.key,
                icon,
                baseVersion: row.metaVersion,
              });
          }}
        />
        <EditableText
          value={String(row.cells[title.id] ?? "")}
          version={row.versions[title.id] ?? 0}
          onCommit={(value, baseVersion) =>
            send({
              kind: "setCells",
              listKey: list.key,
              changes: [
                { rowKey: row.key, columnId: title.id, value, baseVersion },
              ],
            })
          }
          label={title.name}
          placeholder={t("untitledRow")}
          disabled={disabled}
          className="lists-detail-title"
        />
      </div>
      <dl className="lists-row-properties">
        {list.columns
          .filter((column) => !column.archived && column.type !== "title")
          .map((column) => (
            <div key={column.id}>
              <dt>
                <PropertyIcon type={column.type} />
                {column.name}
              </dt>
              <dd>
                <CellEditor
                  column={column}
                  value={row.cells[column.id]}
                  version={row.versions[column.id] ?? 0}
                  disabled={disabled}
                  onChange={(value, baseVersion) =>
                    send({
                      kind: "setCells",
                      listKey: list.key,
                      changes: [
                        {
                          rowKey: row.key,
                          columnId: column.id,
                          value,
                          baseVersion,
                        },
                      ],
                    })
                  }
                />
              </dd>
            </div>
          ))}
      </dl>
      <section className="lists-detail-notes">
        <h3>{t("rowNotes")}</h3>
        <EditableText
          multiline
          maxLength={8000}
          value={row.notes}
          version={row.metaVersion}
          label={t("rowNotes")}
          placeholder={t("notesPlaceholder")}
          disabled={disabled}
          className="lists-notes-input"
          onCommit={(notes, baseVersion) =>
            send({
              kind: "setRow",
              listKey: list.key,
              rowKey: row.key,
              notes,
              baseVersion,
            })
          }
        />
      </section>
      <div className="lists-record-timestamps">
        <span>
          {t("recordCreated")}:{" "}
          <time dateTime={new Date(row.createdAt).toISOString()}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(row.createdAt)}
          </time>
        </span>
        <span>
          {t("recordUpdated")}:{" "}
          <time dateTime={new Date(row.updatedAt).toISOString()}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(row.updatedAt)}
          </time>
        </span>
      </div>
    </Modal>
  );
}
