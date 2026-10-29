"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { DatePicker } from "@/features/lists/components/date-picker";
import { ListSelect } from "@/features/lists/components/list-select";
import {
  COLORS,
  validateEvent,
  type CalendarEvent,
  type EventInput,
} from "@/convex/calendar/time";
import { errorCode, type EventOperation } from "../hooks/use-calendar";
import { addDays } from "../lib/dates";
export function EventDialog({
  event,
  day,
  hour,
  timezone,
  onClose,
  onSave,
}: {
  event?: CalendarEvent;
  day: string;
  hour?: number;
  timezone: string;
  onClose: () => void;
  onSave: (op: EventOperation) => Promise<unknown>;
}) {
  const t = useTranslations("calendar"),
    locale = useLocale();
  const [editing, setEditing] = useState(!event),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [draft, setDraft] = useState<EventInput>(() =>
    event
      ? {
          title: event.title,
          description: event.description,
          location: event.location,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          allDay: event.allDay,
          timezone: event.timezone,
          color: event.color,
        }
      : {
          title: "",
          description: "",
          location: "",
          startDate: day,
          endDate: hour === 23 ? addDays(day, 1) : day,
          startTime: `${String(hour ?? 9).padStart(2, "0")}:00`,
          endTime: `${String(((hour ?? 9) + 1) % 24).padStart(2, "0")}:00`,
          allDay: hour === undefined,
          timezone,
          color: "blue",
        },
  );
  const key = useRef(event?.key ?? crypto.randomUUID()),
    pending = useRef<{ signature: string; op: EventOperation } | null>(null);
  const edit = (part: Partial<EventInput>) => {
    setDraft((d) => ({ ...d, ...part }));
    setError("");
  };
  const perform = async (remove = false) => {
    if (busy) return;
    if (!remove)
      try {
        validateEvent(draft);
      } catch (e) {
        setError(errorCode(e));
        return;
      }
    const operation = {
      key: key.current,
      kind: remove
        ? ("delete" as const)
        : event
          ? ("update" as const)
          : ("create" as const),
      ...(event ? { revision: event.revision } : {}),
      ...(!remove ? { event: draft } : {}),
    };
    const signature = JSON.stringify(operation);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        op: { ...operation, opId: crypto.randomUUID() },
      };
    setBusy(true);
    setError("");
    try {
      await onSave(pending.current!.op);
      onClose();
    } catch (e) {
      setError(errorCode(e));
    } finally {
      setBusy(false);
    }
  };
  const format = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z"));
  return (
    <Modal
      label={t(
        deleting ? "delete" : editing ? (event ? "edit" : "new") : "details",
      )}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        noValidate
        className="calendar-form"
        onSubmit={(e) => {
          e.preventDefault();
          void perform(deleting);
        }}
      >
        <header className="lists-modal-heading">
          <h2>
            {t(
              deleting
                ? "delete"
                : editing
                  ? event
                    ? "edit"
                    : "new"
                  : "details",
            )}
          </h2>
          <button
            type="button"
            aria-label={t("close")}
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {deleting ? (
          <p>{t("deleteWarning", { title: draft.title })}</p>
        ) : !editing ? (
          <div className="calendar-detail">
            <h3>
              <span className="calendar-dot" data-color={draft.color} />
              {draft.title}
            </h3>
            <p>
              {format(draft.startDate)}
              {draft.endDate !== draft.startDate
                ? ` — ${format(draft.endDate)}`
                : ""}
            </p>
            <p>
              {draft.allDay
                ? t("allDay")
                : `${draft.startTime} – ${draft.endTime} · ${draft.timezone}`}
            </p>
            {draft.location && (
              <p>
                {t("location")}: {draft.location}
              </p>
            )}
            {draft.description && (
              <p className="calendar-description">{draft.description}</p>
            )}
          </div>
        ) : (
          <fieldset disabled={busy}>
            <label>
              {t("title")}
              <input
                autoFocus
                value={draft.title}
                maxLength={120}
                required
                onChange={(e) => edit({ title: e.target.value })}
              />
            </label>
            <label className="calendar-checkbox">
              <input
                type="checkbox"
                checked={draft.allDay}
                onChange={(e) => edit({ allDay: e.target.checked })}
              />
              {t("allDay")}
            </label>
            <div className="calendar-form-dates">
              <div>
                <span>{t("start")}</span>
                <DatePicker
                  label={t("start")}
                  value={draft.startDate}
                  onChange={(value) => {
                    if (value)
                      edit({
                        startDate: value,
                        ...(value > draft.endDate ? { endDate: value } : {}),
                      });
                  }}
                />
                {!draft.allDay && (
                  <label>
                    {t("startTime")}
                    <input
                      aria-label={t("startTime")}
                      inputMode="numeric"
                      placeholder="09:00"
                      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                      value={draft.startTime}
                      onChange={(e) => edit({ startTime: e.target.value })}
                      required
                    />
                  </label>
                )}
              </div>
              <div>
                <span>{t("end")}</span>
                <DatePicker
                  label={t("end")}
                  value={draft.endDate}
                  onChange={(value) => {
                    if (value) edit({ endDate: value });
                  }}
                />
                {!draft.allDay && (
                  <label>
                    {t("endTime")}
                    <input
                      aria-label={t("endTime")}
                      inputMode="numeric"
                      placeholder="10:00"
                      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                      value={draft.endTime}
                      onChange={(e) => edit({ endTime: e.target.value })}
                      required
                    />
                  </label>
                )}
              </div>
            </div>
            {!draft.allDay && (
              <>
                <label>
                  {t("timezone")}
                  <input
                    value={draft.timezone}
                    required
                    placeholder="America/Bogota"
                    onChange={(e) => edit({ timezone: e.target.value })}
                  />
                </label>
                <p className="calendar-help">{t("dstHint")}</p>
              </>
            )}
            <label>
              {t("color")}
              <ListSelect
                label={t("color")}
                value={draft.color}
                options={COLORS.map((color) => ({
                  value: color,
                  label: t(`colors.${color}`),
                  icon: <span className="calendar-dot" data-color={color} />,
                }))}
                onChange={(color) => edit({ color })}
              />
            </label>
            <label>
              {t("location")}
              <input
                maxLength={300}
                value={draft.location}
                onChange={(e) => edit({ location: e.target.value })}
              />
            </label>
            <label>
              {t("description")}
              <textarea
                rows={3}
                maxLength={5000}
                value={draft.description}
                onChange={(e) => edit({ description: e.target.value })}
              />
            </label>
          </fieldset>
        )}
        {error && (
          <p className="calendar-error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <footer className="lists-modal-actions">
          {event && !editing && !deleting ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="lists-danger"
                onClick={() => setDeleting(true)}
              >
                {t("delete")}
              </button>
              <button
                type="button"
                className="lists-primary"
                onClick={() => setEditing(true)}
              >
                {t("edit")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="lists-secondary"
                disabled={busy}
                onClick={() => (deleting ? setDeleting(false) : onClose())}
              >
                {t("cancel")}
              </button>
              <button
                className={`lists-primary ${deleting ? "lists-delete-confirm" : ""}`}
                disabled={busy}
              >
                {t(busy ? "saving" : deleting ? "delete" : "save")}
              </button>
            </>
          )}
        </footer>
      </form>
    </Modal>
  );
}
