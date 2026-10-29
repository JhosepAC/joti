"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CellValue, ListColumn } from "../types";
import { Popover } from "./overlays";
import { ListGlyph } from "./list-icon";
export function ChoicePicker({
  column,
  value,
  onChange,
  label,
  disabled = false,
  onCreateOption,
  onEditOptions,
}: {
  column: ListColumn;
  value: CellValue | undefined;
  onChange: (value: CellValue) => void;
  label: string;
  disabled?: boolean;
  onCreateOption?: (label: string) => string;
  onEditOptions?: () => void;
}) {
  const t = useTranslations("lists"),
    id = useId(),
    anchor = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(0);
  const multiple = column.type === "multiSelect",
    selected = Array.isArray(value)
      ? value
      : typeof value === "string" && value
        ? [value]
        : [];
  const options = column.options.filter(
    (option) =>
      !option.archived &&
      option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const canCreate =
    !!onCreateOption &&
    column.options.length < 100 &&
    search.trim() &&
    !column.options.some(
      (option) =>
        option.label.toLocaleLowerCase() === search.trim().toLocaleLowerCase(),
    );
  const close = () => {
    setOpen(false);
    setSearch("");
    requestAnimationFrame(() => anchor.current?.focus());
  };
  const choose = (key: string) => {
    onChange(
      multiple
        ? selected.includes(key)
          ? selected.filter((id) => id !== key)
          : [...selected, key]
        : key,
    );
    if (!multiple) close();
  };
  const create = () => {
    if (canCreate && onCreateOption) {
      choose(onCreateOption(search.trim()));
      setSearch("");
      setActive(0);
    }
  };
  return (
    <>
      <button
        type="button"
        ref={anchor}
        className="lists-select-cell"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setActive(0);
          setSearch("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected.length ? (
          selected.map((key) => {
            const option = column.options.find((option) => option.id === key);
            return (
              <span
                key={key}
                className={`lists-chip lists-color-${option?.color ?? "gray"}`}
              >
                {column.type === "status" && <i />}
                {option?.label ?? key}
              </span>
            );
          })
        ) : (
          <span className="lists-empty-cell">{t("chooseValue")}</span>
        )}
      </button>
      {open && (
        <Popover
          anchor={anchor}
          label={column.name}
          onClose={() => setOpen(false)}
        >
          <div
            className="lists-choice-panel"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next =
                  (active +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    Math.max(1, options.length)) %
                  Math.max(1, options.length);
                setActive(next);
                document
                  .getElementById(id + next)
                  ?.scrollIntoView({ block: "nearest" });
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (event.ctrlKey || event.metaKey) close();
                else if (options[active]) choose(options[active].id);
                else create();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          >
            <div className="lists-choice-heading">
              <span>{column.name}</span>
              {multiple && (
                <small>{t("selectedCount", { count: selected.length })}</small>
              )}
            </div>
            <input
              className="lists-select-search"
              autoFocus
              maxLength={60}
              aria-label={t("findOption")}
              placeholder={t("findOption")}
              role="combobox"
              aria-expanded="true"
              aria-controls={id}
              aria-activedescendant={options[active] ? id + active : undefined}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActive(0);
              }}
            />
            <div
              className="lists-choice-options"
              id={id}
              role="listbox"
              aria-label={column.name}
              aria-multiselectable={multiple}
            >
              {options.map((option, index) => (
                <button
                  id={id + index}
                  key={option.id}
                  role="option"
                  type="button"
                  tabIndex={-1}
                  aria-selected={selected.includes(option.id)}
                  data-active={active === index}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option.id)}
                >
                  <span
                    className={`lists-choice-mark lists-color-${option.color}`}
                  />
                  <span className={`lists-chip lists-color-${option.color}`}>
                    {column.type === "status" && <i />}
                    {option.label}
                  </span>
                  <span className="lists-choice-check">
                    {selected.includes(option.id) && <ListGlyph name="tick" />}
                  </span>
                </button>
              ))}
              {!options.length && (
                <p className="lists-select-empty">{t("noOptionsFound")}</p>
              )}
            </div>
            {canCreate && (
              <button
                type="button"
                className="lists-create-option"
                onClick={create}
              >
                <ListGlyph name="plus" />
                {t("createOption", { name: search.trim() })}
              </button>
            )}
            <footer className="lists-choice-footer">
              <button
                type="button"
                onClick={() => {
                  onChange(multiple ? [] : null);
                  close();
                }}
              >
                {t("clearValue")}
              </button>
              {onEditOptions && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onEditOptions();
                  }}
                >
                  <ListGlyph name="edit" />
                  {t("editOptions")}
                </button>
              )}
              {multiple && (
                <button type="button" onClick={close}>
                  {t("done")}
                </button>
              )}
            </footer>
          </div>
        </Popover>
      )}
    </>
  );
}
