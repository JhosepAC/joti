"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DatePicker } from "@/features/lists/components/date-picker";
import { ListGlyph } from "@/features/lists/components/list-icon";
import {
  COLORS,
  daySegment,
  inZone,
  layoutEvents,
  canonicalTimezone,
  resolveTimezone,
  type CalendarEvent,
} from "@/convex/calendar/time";
import { useCalendar } from "../hooks/use-calendar";
import { addDays, daysFor, navigate, type CalendarView } from "../lib/dates";
import { EventDialog } from "./event-dialog";
import { TimezoneSelect } from "./timezone-select";
import "./calendar.css";
export function CalendarModule({
  slug,
  timezone: initialTimezone,
}: {
  slug: string;
  timezone?: string;
}) {
  const t = useTranslations("calendar"),
    locale = useLocale();
  const timeline = useRef<HTMLDivElement>(null);
  const [timezonePreference, setTimezonePreference] = useState(
      canonicalTimezone(initialTimezone) ?? "system",
    ),
    [now, setNow] = useState(() => Date.now());
  const timezone = resolveTimezone(timezonePreference);
  const today = inZone(now, timezone).date;
  const [selected, setSelected] = useState(today),
    [view, setView] = useState<CalendarView>("month"),
    [search, setSearch] = useState(""),
    [hidden, setHidden] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{
      day: string;
      hour?: number;
      event?: CalendarEvent;
    } | null>(null),
    [success, setSuccess] = useState("");
  const days = useMemo(() => daysFor(selected, view), [selected, view]);
  const model = useCalendar(slug, days[0]!, days[days.length - 1]!);
  const loaded = model.events !== undefined;
  useEffect(() => {
    if (view !== "month" && loaded && timeline.current)
      timeline.current.scrollTop = 7 * 60;
  }, [view, loaded]);
  const events = useMemo(
    () =>
      (model.events ?? [])
        .filter(
          (e) =>
            !hidden.includes(e.color) &&
            `${e.title} ${e.description} ${e.location}`
              .toLocaleLowerCase(locale)
              .includes(search.toLocaleLowerCase(locale)),
        )
        .sort(
          (a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title),
        ),
    [model.events, hidden, search, locale],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 4000);
    return () => clearTimeout(timer);
  }, [success]);
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
      new Date(day + "T12:00:00Z"),
    );
  const dayEvents = (day: string) =>
    events.filter((event) => daySegment(event, day, timezone));
  const title =
    view === "month"
      ? format(selected, { month: "long", year: "numeric" })
      : view === "day"
        ? format(selected, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : `${format(days[0]!, { day: "numeric", month: "short", year: "numeric" })} – ${format(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  const eventTime = (event: CalendarEvent) =>
    event.allDay
      ? t("allDay")
      : `${inZone(event.startsAt, timezone).time}–${inZone(event.endsAt, timezone).time}`;
  const eventButton = (event: CalendarEvent, compact = false) => (
    <button
      type="button"
      key={event.key}
      className={compact ? "calendar-event" : "calendar-agenda-event"}
      data-event-key={event.key}
      data-color={event.color}
      onClick={() => setDialog({ day: selected, event })}
      title={`${event.title} · ${eventTime(event)}`}
    >
      <span className="calendar-dot" data-color={event.color} />
      <span>
        <strong>{event.title}</strong>
        {!compact && event.location && <small>{event.location}</small>}
      </span>
      <time>
        {compact
          ? event.allDay
            ? ""
            : inZone(event.startsAt, timezone).time
          : eventTime(event)}
      </time>
    </button>
  );
  const agenda = (
    <section className="calendar-agenda">
      <header>
        <h2>
          {format(selected, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <button
          className="lists-secondary"
          onClick={() => setDialog({ day: selected })}
        >
          {t("new")}
        </button>
      </header>
      {dayEvents(selected).length ? (
        dayEvents(selected).map((e) => eventButton(e))
      ) : (
        <p>{t(search || hidden.length ? "noMatches" : "emptyDay")}</p>
      )}
    </section>
  );
  const go = (direction: number) => {
    const next = navigate(selected, view, direction);
    if (next >= "1900-01-01" && next <= "2100-12-31") setSelected(next);
  };
  return (
    <section className="calendar-module lists-surface" data-view={view}>
      <header className="calendar-heading">
        <div>
          <h1>{t("name")}</h1>
          <p>{title}</p>
        </div>
        <button
          className="lists-primary"
          disabled={!model.events}
          onClick={() => setDialog({ day: selected })}
        >
          <ListGlyph name="plus" />
          {t("new")}
        </button>
      </header>
      <div className="calendar-controls">
        <div className="calendar-navigation">
          <button aria-label={t("previous")} onClick={() => go(-1)}>
            <ListGlyph name="up" />
          </button>
          <button onClick={() => setSelected(today)}>{t("today")}</button>
          <button aria-label={t("next")} onClick={() => go(1)}>
            <ListGlyph name="down" />
          </button>
        </div>
        <DatePicker
          value={selected}
          label={t("jump")}
          onChange={(value) => {
            if (value && value >= "1900-01-01" && value <= "2100-12-31")
              setSelected(value);
          }}
        />
        <div className="calendar-views" role="group" aria-label={t("view")}>
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              aria-pressed={mode === view}
              key={mode}
              onClick={() => setView(mode)}
            >
              {t(mode)}
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-options">
        <label>
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <TimezoneSelect
          value={timezonePreference}
          onChange={setTimezonePreference}
        />
      </div>
      <div className="calendar-filters" role="group" aria-label={t("filter")}>
        {COLORS.map((color) => (
          <button
            key={color}
            aria-pressed={!hidden.includes(color)}
            onClick={() =>
              setHidden((old) =>
                old.includes(color)
                  ? old.filter((c) => c !== color)
                  : [...old, color],
              )
            }
          >
            <span className="calendar-dot" data-color={color} />
            {t(`colors.${color}`)}
          </button>
        ))}
      </div>
      {success && (
        <p className="calendar-success" role="status">
          {success}
        </p>
      )}
      {model.error ? (
        <div role="alert" className="calendar-error">
          <p>{t(`errors.${model.error}`)}</p>
          <button onClick={() => void model.retry()}>{t("retry")}</button>
        </div>
      ) : !model.events ? (
        <div className="calendar-loading" aria-busy="true">
          {t("loading")}
        </div>
      ) : (
        <>
          {!model.online && (
            <p className="calendar-offline" role="status">
              {t("offline")}
            </p>
          )}
          {view === "month" ? (
            <div className="calendar-month" role="grid" aria-label={title}>
              <div className="calendar-weekdays" role="row">
                {days.slice(0, 7).map((day) => (
                  <span role="columnheader" key={day}>
                    {format(day, { weekday: "short" })}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, week) => (
                <div role="row" className="calendar-week" key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((day) => {
                    const items = dayEvents(day);
                    return (
                      <div
                        role="gridcell"
                        aria-selected={selected === day}
                        key={day}
                        className="calendar-day"
                        data-outside={day.slice(0, 7) !== selected.slice(0, 7)}
                        data-today={day === today}
                      >
                        <button
                          data-day={day}
                          tabIndex={day === selected ? 0 : -1}
                          className="calendar-day-number"
                          aria-label={format(day, { dateStyle: "full" })}
                          aria-current={day === today ? "date" : undefined}
                          onClick={() => {
                            setSelected(day);
                            if (!items.length) setDialog({ day });
                          }}
                          onKeyDown={(e) => {
                            const delta: Record<string, number> = {
                              ArrowLeft: -1,
                              ArrowRight: 1,
                              ArrowUp: -7,
                              ArrowDown: 7,
                              Home: -(
                                (new Date(day + "T12:00:00Z").getUTCDay() + 6) %
                                7
                              ),
                              End:
                                6 -
                                ((new Date(day + "T12:00:00Z").getUTCDay() +
                                  6) %
                                  7),
                            };
                            if (e.key in delta) {
                              e.preventDefault();
                              const next = addDays(day, delta[e.key]!);
                              setSelected(next);
                              requestAnimationFrame(() =>
                                document
                                  .querySelector<HTMLButtonElement>(
                                    `[data-day="${next}"]`,
                                  )
                                  ?.focus(),
                              );
                            }
                          }}
                        >
                          {Number(day.slice(-2))}
                        </button>
                        <div className="calendar-day-events">
                          {items
                            .slice(0, 3)
                            .map((event) => eventButton(event, true))}
                          {items.length > 3 && (
                            <button
                              className="calendar-more"
                              onClick={() => {
                                setSelected(day);
                                document
                                  .querySelector(".calendar-agenda")
                                  ?.scrollIntoView({ block: "nearest" });
                              }}
                            >
                              {t("more", { count: items.length - 3 })}
                            </button>
                          )}
                        </div>
                        <span className="calendar-mobile-count">
                          {items.length > 0
                            ? t("eventCount", { count: items.length })
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="calendar-week-strip">
                {days.map((day) => (
                  <button
                    key={day}
                    aria-pressed={selected === day}
                    onClick={() => setSelected(day)}
                  >
                    {format(day, { weekday: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
              <div className="calendar-time-scroll" ref={timeline}>
                <div
                  className="calendar-time-grid"
                  style={{
                    gridTemplateColumns: `48px repeat(${days.length}, minmax(0,1fr))`,
                  }}
                >
                  <div />
                  {days.map((day) => (
                    <button
                      className="calendar-time-heading"
                      key={day}
                      data-today={day === today}
                      onClick={() => setSelected(day)}
                    >
                      {format(day, { weekday: "short", day: "numeric" })}
                    </button>
                  ))}
                  <span className="calendar-all-day-label">{t("allDay")}</span>
                  {days.map((day) => (
                    <div className="calendar-all-day" key={day}>
                      {dayEvents(day)
                        .filter((e) => e.allDay)
                        .slice(0, 3)
                        .map((e) => eventButton(e, true))}
                      {dayEvents(day).filter((e) => e.allDay).length > 3 && (
                        <button
                          className="calendar-more"
                          onClick={() => {
                            setSelected(day);
                            document
                              .querySelector(".calendar-agenda")
                              ?.scrollIntoView({ block: "nearest" });
                          }}
                        >
                          {t("more", {
                            count:
                              dayEvents(day).filter((e) => e.allDay).length - 3,
                          })}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="calendar-hours">
                    {Array.from({ length: 24 }, (_, i) => (
                      <time key={i}>{String(i).padStart(2, "0")}:00</time>
                    ))}
                  </div>
                  {days.map((day) => (
                    <div className="calendar-time-day" key={day}>
                      {Array.from({ length: 24 }, (_, hour) => (
                        <button
                          key={hour}
                          className="calendar-hour-slot"
                          data-slot={`${day}/${hour}`}
                          tabIndex={day === selected && hour === 9 ? 0 : -1}
                          onKeyDown={(event) => {
                            const offsets: Record<string, number> = {
                              ArrowUp: -1,
                              ArrowDown: 1,
                              ArrowLeft: -24,
                              ArrowRight: 24,
                            };
                            if (event.key in offsets) {
                              event.preventDefault();
                              const index =
                                days.indexOf(day) * 24 +
                                hour +
                                offsets[event.key]!;
                              const nextDay = days[Math.floor(index / 24)];
                              if (nextDay)
                                document
                                  .querySelector<HTMLButtonElement>(
                                    `[data-slot="${nextDay}/${index % 24}"]`,
                                  )
                                  ?.focus();
                            }
                          }}
                          aria-label={t("createAt", {
                            date: day,
                            time: `${String(hour).padStart(2, "0")}:00`,
                          })}
                          onClick={() => setDialog({ day, hour })}
                        />
                      ))}
                      {layoutEvents(events, day, timezone).map((item) => (
                        <button
                          className="calendar-timed-event"
                          data-event-key={item.event.key}
                          key={item.event.key}
                          data-color={item.event.color}
                          style={{
                            top: item.start,
                            width: `${100 / item.lanes}%`,
                            left: `${(100 * item.lane) / item.lanes}%`,
                            height: Math.max(
                              20,
                              Math.min(item.end, 1440) - item.start,
                            ),
                          }}
                          onClick={() => setDialog({ day, event: item.event })}
                          title={`${item.event.title} · ${eventTime(item.event)}`}
                        >
                          <strong>{item.event.title}</strong>
                          <span>{eventTime(item.event)}</span>
                        </button>
                      ))}
                      {day === today && (
                        <div
                          className="calendar-now"
                          aria-hidden="true"
                          style={{
                            top:
                              Number(inZone(now, timezone).time.slice(0, 2)) *
                                60 +
                              Number(inZone(now, timezone).time.slice(3)),
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {agenda}
        </>
      )}
      {dialog && (
        <EventDialog
          key={dialog.event?.key ?? `${dialog.day}-${dialog.hour ?? "all"}`}
          {...dialog}
          timezone={timezone}
          onClose={() => setDialog(null)}
          onSave={async (operation) => {
            await model.save(operation);
            setSuccess(t(operation.kind === "delete" ? "deleted" : "saved"));
          }}
        />
      )}
    </section>
  );
}
