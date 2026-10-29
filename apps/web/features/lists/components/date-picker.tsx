"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "./overlays";
import { ListGlyph, PropertyIcon } from "./list-icon";
import { ListSelect } from "./list-select";
import { calendarDays, dateKey, parseDateKey, makeDate } from "../lib/dates";

export function DatePicker({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const locale = useLocale(),
    t = useTranslations("lists"),
    anchor = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDateKey(value) ?? new Date()),
    [focus, setFocus] = useState(() => value || dateKey(new Date())),
    [draft, setDraft] = useState(value),
    [invalid, setInvalid] = useState(false);
  const today = dateKey(new Date()),
    year = month.getFullYear();
  const choose = (key: string | null) => {
    onChange(key);
    setOpen(false);
    setInvalid(false);
    requestAnimationFrame(() => anchor.current?.focus());
  };
  const go = (date: Date) => {
    if (date.getFullYear() < 0 || date.getFullYear() > 9999) return;
    setMonth(makeDate(date.getFullYear(), date.getMonth()));
    setFocus(dateKey(date));
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          `[data-calendar-day="${dateKey(date)}"]`,
        )
        ?.focus(),
    );
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="lists-date-trigger"
        aria-label={value ? `${label}: ${value}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setMonth(parseDateKey(value) ?? new Date());
          setDraft(value);
          setFocus(value || today);
          setInvalid(false);
          setOpen((v) => !v);
        }}
      >
        <PropertyIcon type="date" />
        <span>
          {value && parseDateKey(value)
            ? new Intl.DateTimeFormat(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(parseDateKey(value)!)
            : t("chooseDate")}
        </span>
      </button>
      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div
            className="lists-calendar"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                anchor.current?.focus();
              }
            }}
          >
            <form
              className="lists-calendar-input"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!draft.trim()) choose(null);
                else if (parseDateKey(draft)) choose(draft);
                else setInvalid(true);
              }}
            >
              <input
                aria-label={t("dateValue")}
                value={draft}
                placeholder={t("datePlaceholder")}
                aria-invalid={invalid}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setInvalid(false);
                }}
              />
              <button type="submit" aria-label={t("apply")}>
                <ListGlyph name="tick" />
              </button>
            </form>
            {invalid && (
              <p role="alert" className="lists-form-error">
                {t("invalidDate")}
              </p>
            )}
            <div className="lists-calendar-heading">
              <button
                type="button"
                className="lists-icon-button lists-calendar-prev"
                aria-label={t("previousMonth")}
                onClick={() => go(makeDate(year, month.getMonth() - 1))}
              >
                <ListGlyph name="right" />
              </button>
              <div>
                <ListSelect
                  label={t("month")}
                  value={String(month.getMonth())}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i),
                    label: new Intl.DateTimeFormat(locale, {
                      month: "long",
                    }).format(new Date(2026, i, 1)),
                  }))}
                  onChange={(v) => go(makeDate(year, Number(v)))}
                />
                <ListSelect
                  label={t("year")}
                  value={String(year)}
                  options={Array.from(
                    {
                      length:
                        Math.min(9999, year + 100) -
                        Math.max(0, year - 100) +
                        1,
                    },
                    (_, i) => ({
                      value: String(Math.max(0, year - 100) + i),
                      label: String(Math.max(0, year - 100) + i),
                    }),
                  )}
                  onChange={(v) => go(makeDate(Number(v), month.getMonth()))}
                />
              </div>
              <button
                type="button"
                className="lists-icon-button"
                aria-label={t("nextMonth")}
                onClick={() => go(makeDate(year, month.getMonth() + 1))}
              >
                <ListGlyph name="right" />
              </button>
            </div>
            <div className="lists-calendar-weekdays" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>
                  {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
                    new Date(2026, 9, 26 + i),
                  )}
                </span>
              ))}
            </div>
            <div
              role="grid"
              aria-label={new Intl.DateTimeFormat(locale, {
                month: "long",
                year: "numeric",
              }).format(month)}
              className="lists-calendar-grid"
            >
              {Array.from({ length: 6 }, (_, week) => (
                <div role="row" key={week}>
                  {calendarDays(month)
                    .slice(week * 7, week * 7 + 7)
                    .map((date) => {
                      const key = dateKey(date);
                      return (
                        <button
                          type="button"
                          role="gridcell"
                          key={key}
                          data-calendar-day={key}
                          aria-label={new Intl.DateTimeFormat(locale, {
                            dateStyle: "full",
                          }).format(date)}
                          aria-selected={value === key}
                          aria-current={today === key ? "date" : undefined}
                          data-outside={date.getMonth() !== month.getMonth()}
                          tabIndex={focus === key ? 0 : -1}
                          data-popover-focus={focus === key ? "" : undefined}
                          disabled={
                            date.getFullYear() < 0 || date.getFullYear() > 9999
                          }
                          onClick={() => choose(key)}
                          onKeyDown={(e) => {
                            const delta: Record<string, number> = {
                              ArrowLeft: -1,
                              ArrowRight: 1,
                              ArrowUp: -7,
                              ArrowDown: 7,
                              Home: -((date.getDay() + 6) % 7),
                              End: 6 - ((date.getDay() + 6) % 7),
                            };
                            if (e.key in delta) {
                              e.preventDefault();
                              const next = new Date(date);
                              next.setDate(next.getDate() + delta[e.key]!);
                              go(next);
                            } else if (
                              e.key === "PageUp" ||
                              e.key === "PageDown"
                            ) {
                              e.preventDefault();
                              const step = e.key === "PageUp" ? -1 : 1,
                                next = makeDate(
                                  date.getFullYear() + (e.shiftKey ? step : 0),
                                  date.getMonth() + (e.shiftKey ? 0 : step),
                                );
                              go(
                                makeDate(
                                  next.getFullYear(),
                                  next.getMonth(),
                                  Math.min(
                                    date.getDate(),
                                    makeDate(
                                      next.getFullYear(),
                                      next.getMonth() + 1,
                                      0,
                                    ).getDate(),
                                  ),
                                ),
                              );
                            }
                          }}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
            <span className="sr-only" aria-live="polite">
              {new Intl.DateTimeFormat(locale, {
                month: "long",
                year: "numeric",
              }).format(month)}
            </span>
            <footer>
              <button type="button" onClick={() => choose(today)}>
                {t("today")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  choose(dateKey(tomorrow));
                }}
              >
                {t("tomorrow")}
              </button>
              <button type="button" onClick={() => choose(null)}>
                {t("clearValue")}
              </button>
            </footer>
          </div>
        </Popover>
      )}
    </>
  );
}
