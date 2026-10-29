"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CellValue, ListData, ListRow, ListCommand } from "../types";
import { Modal } from "./overlays";
import { ListSelect } from "./list-select";
import { CellEditor } from "./cell-editor";
import { ListGlyph, PropertyIcon } from "./list-icon";
export function BulkEditor({
  list,
  rows,
  onClose,
  send,
}: {
  list: ListData;
  rows: ListRow[];
  onClose: () => void;
  send: (command: ListCommand) => unknown;
}) {
  const t = useTranslations("lists"),
    columns = list.columns.filter((c) => !c.archived),
    [id, setId] = useState(columns[0]!.id),
    [value, setValue] = useState<CellValue>(null),
    [dirty, setDirty] = useState(false);
  const originals = useRef(structuredClone(rows)),
    column = columns.find((c) => c.id === id)!;
  const apply = (value: CellValue) => {
    send({
      kind: "setCells",
      listKey: list.key,
      changes: originals.current.map((row) => ({
        rowKey: row.key,
        columnId: id,
        value,
        baseVersion: row.versions[id] ?? 0,
      })),
    });
    onClose();
  };
  return (
    <Modal label={t("bulkEdit")} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !e.currentTarget.querySelector('[aria-invalid="true"]'))
            apply(value);
        }}
      >
        <header className="lists-modal-heading">
          <h2>{t("bulkEdit")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <ListGlyph name="close" />
          </button>
        </header>
        <p className="lists-hint">{t("bulkHint")}</p>
        <label className="lists-form-label">
          {t("bulkProperty")}
          <ListSelect
            label={t("bulkProperty")}
            value={id}
            options={columns.map((c) => ({
              value: c.id,
              label: c.name,
              icon: <PropertyIcon type={c.type} />,
            }))}
            onChange={(value) => {
              setId(value);
              setValue(null);
              setDirty(false);
            }}
          />
        </label>
        <div className="lists-form-label">
          <span>{t("bulkValue")}</span>
          <div className="lists-bulk-value">
            <CellEditor
              key={id}
              column={column}
              value={value}
              label={t("bulkValue")}
              onChange={(value) => {
                setValue(value);
                setDirty(true);
              }}
            />
          </div>
        </div>
        <footer className="lists-modal-actions">
          <button
            type="button"
            className="lists-secondary"
            onClick={() => apply(null)}
          >
            {t("clearSelectedCells")}
          </button>
          <button type="submit" className="lists-primary" disabled={!dirty}>
            {t("applyToSelected", { count: rows.length })}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
