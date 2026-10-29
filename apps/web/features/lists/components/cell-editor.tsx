"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CellValue, ListColumn } from "../types";
import { EditableText } from "./editable-text";
import { ChoicePicker } from "./choice-picker";
import { DatePicker } from "./date-picker";
import { ListGlyph } from "./list-icon";

export function CellEditor({
  column,
  value,
  onChange,
  disabled = false,
  label,
  onCreateOption,
  onEditOptions,
  version = 0,
  wrap = false,
}: {
  column: ListColumn;
  value: CellValue | undefined;
  onChange: (value: CellValue, baseVersion: number) => void;
  disabled?: boolean;
  label?: string;
  onCreateOption?: (label: string) => string;
  onEditOptions?: () => void;
  version?: number;
  wrap?: boolean;
}) {
  const t = useTranslations("lists"),
    [invalid, setInvalid] = useState(false),
    accessible = label ?? column.name;
  if (column.type === "checkbox")
    return (
      <input
        type="checkbox"
        className="lists-checkbox"
        checked={value === true}
        aria-label={accessible}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, version)}
      />
    );
  if (["select", "multiSelect", "status"].includes(column.type))
    return (
      <ChoicePicker
        column={column}
        value={value}
        label={accessible}
        disabled={disabled}
        onChange={(value) => onChange(value, version)}
        onCreateOption={onCreateOption}
        onEditOptions={onEditOptions}
      />
    );
  if (column.type === "date")
    return (
      <DatePicker
        value={typeof value === "string" ? value : ""}
        label={accessible}
        disabled={disabled}
        onChange={(value) => onChange(value, version)}
      />
    );
  if (column.type === "rating")
    return (
      <div
        className="lists-rating"
        role="radiogroup"
        aria-label={accessible}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return;
          const current = typeof value === "number" ? value : 0;
          if (
            [
              "ArrowLeft",
              "ArrowDown",
              "ArrowRight",
              "ArrowUp",
              "Home",
              "End",
              "Delete",
              "Backspace",
            ].includes(event.key)
          ) {
            event.preventDefault();
            onChange(
              event.key === "Home"
                ? 1
                : event.key === "End"
                  ? 5
                  : ["Delete", "Backspace"].includes(event.key)
                    ? null
                    : Math.max(
                        1,
                        Math.min(
                          5,
                          current +
                            (["ArrowLeft", "ArrowDown"].includes(event.key)
                              ? -1
                              : 1),
                        ),
                      ),
              version,
            );
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            tabIndex={-1}
            aria-label={t("ratingValue", { value: n })}
            aria-checked={value === n}
            data-filled={typeof value === "number" && value >= n}
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n, version)}
          >
            <ListGlyph name="star" />
          </button>
        ))}
      </div>
    );
  if (["number", "currency", "percent"].includes(column.type))
    return (
      <span
        className="lists-number-wrap"
        data-unit={
          column.type === "currency"
            ? (column.currency ?? "USD")
            : column.type === "percent"
              ? "%"
              : undefined
        }
      >
        <EditableText
          invalid={invalid}
          onDraftChange={() => setInvalid(false)}
          version={version}
          value={value == null ? "" : String(value)}
          disabled={disabled}
          label={accessible}
          className="lists-cell-input lists-number-cell"
          onCommit={(text, base) => {
            const raw = text.trim().replace(/^(-?\d+),(\d+)$/, "$1.$2"),
              number = Number(raw);
            if (!raw) {
              setInvalid(false);
              onChange(null, base);
            } else if (
              Number.isFinite(number) &&
              Math.abs(number) <= 1e15 &&
              (column.type !== "percent" || (number >= 0 && number <= 100))
            ) {
              setInvalid(false);
              onChange(number, base);
            } else {
              setInvalid(true);
              return false;
            }
          }}
        />
        {invalid && (
          <span className="lists-cell-validation" role="alert">
            {t(column.type === "percent" ? "invalidPercent" : "invalidNumber")}
          </span>
        )}
      </span>
    );
  const type = column.type;
  const href =
    typeof value === "string" && value
      ? type === "url" && /^https?:\/\//i.test(value)
        ? value
        : type === "email"
          ? "mailto:" + value
          : type === "phone"
            ? "tel:" + value.replace(/[^+\d]/g, "")
            : null
      : null;
  return (
    <span className="lists-text-wrap">
      <EditableText
        invalid={invalid}
        onDraftChange={() => setInvalid(false)}
        version={version}
        multiline={wrap && ["text", "title"].includes(type)}
        className={`lists-cell-input ${type === "title" ? "lists-title-cell" : ""}`}
        value={typeof value === "string" ? value : ""}
        label={accessible}
        disabled={disabled}
        placeholder={type === "title" ? t("untitledRow") : ""}
        onCommit={(text, base) => {
          let valid = true;
          if (text && type === "url") {
            try {
              valid = ["http:", "https:"].includes(new URL(text).protocol);
            } catch {
              valid = false;
            }
          }
          if (text && type === "email")
            valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
          if (text && type === "phone")
            valid =
              /^[+\d\s().-]{3,40}$/.test(text) &&
              text.replace(/\D/g, "").length >= 3;
          setInvalid(!valid);
          if (valid) onChange(text, base);
          else return false;
        }}
      />
      {href && (
        <a
          className="lists-value-link"
          href={href}
          target={type === "url" ? "_blank" : undefined}
          rel={type === "url" ? "noopener noreferrer" : undefined}
          aria-label={t(
            type === "email"
              ? "sendEmail"
              : type === "phone"
                ? "callNumber"
                : "openLink",
          )}
        >
          <ListGlyph name="open" />
        </a>
      )}
      {invalid && (
        <span className="lists-cell-validation" role="alert">
          {t(
            type === "email"
              ? "invalidEmail"
              : type === "phone"
                ? "invalidPhone"
                : "invalidUrl",
          )}
        </span>
      )}
    </span>
  );
}
