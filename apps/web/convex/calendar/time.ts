export const COLORS = ["blue", "green", "orange", "red", "gray"] as const;
export type EventInput = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timezone: string;
  color: string;
};
export type CalendarEvent = EventInput & {
  key: string;
  revision: number;
  startsAt: number;
  endsAt: number;
};
/** Profile preferences may contain `system`; event storage must contain a concrete zone. */
export function canonicalTimezone(value?: string): string | null {
  if (!value?.trim() || value.trim() === "system") return null;
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: value.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
export function resolveTimezone(
  value?: string,
  deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  return canonicalTimezone(value) ?? canonicalTimezone(deviceTimezone) ?? "UTC";
}
export function validDate(key: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
    key < "1899-01-01" ||
    key > "2101-12-31"
  )
    return false;
  const date = new Date(key + "T12:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === key;
}
export function addDays(key: string, days: number) {
  const date = new Date(key + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function inZone(time: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
/** Round-trip candidate offsets: rejects DST gaps; repeated hours use the earlier instant. */
export function wallTime(date: string, time: string, timezone: string) {
  if (!canonicalTimezone(timezone)) throw new Error("TIMEZONE_ERROR");
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("VALIDATION_ERROR");
  const wall = Date.parse(`${date}T${time}:00Z`),
    candidates = new Set<number>();
  for (const hours of [-48, -24, 0, 24, 48]) {
    const sample = wall + hours * 3600000,
      local = inZone(sample, timezone);
    const offset = Date.parse(`${local.date}T${local.time}:00Z`) - sample;
    const candidate = wall - offset,
      check = inZone(candidate, timezone);
    if (check.date === date && check.time === time) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error("DST_GAP");
  return Math.min(...candidates);
}
export function validateEvent(input: EventInput) {
  if (
    !input.title.trim() ||
    input.title.length > 120 ||
    input.description.length > 5000 ||
    input.location.length > 300 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(
      input.title + input.description + input.location,
    ) ||
    !COLORS.includes(input.color as (typeof COLORS)[number]) ||
    !validDate(input.startDate) ||
    !validDate(input.endDate) ||
    input.startDate < "1900-01-01" ||
    input.endDate > "2100-12-31" ||
    input.endDate < input.startDate
  )
    throw new Error("VALIDATION_ERROR");
  if (input.timezone.length > 80) throw new Error("VALIDATION_ERROR");
  const timezone = canonicalTimezone(input.timezone);
  if (!timezone) throw new Error("TIMEZONE_ERROR");
  const startsAt = input.allDay
    ? Date.parse(input.startDate + "T00:00:00Z")
    : wallTime(input.startDate, input.startTime, timezone);
  const endsAt = input.allDay
    ? Date.parse(addDays(input.endDate, 1) + "T00:00:00Z")
    : wallTime(input.endDate, input.endTime, timezone);
  if (endsAt <= startsAt) throw new Error("END_BEFORE_START");
  return {
    ...input,
    timezone,
    title: input.title.trim(),
    startTime: input.allDay ? "" : input.startTime,
    endTime: input.allDay ? "" : input.endTime,
    startsAt,
    endsAt,
  };
}
/** Change the event's zone without rescheduling it; all-day dates have no UTC conversion. */
export function convertEventTimezone(
  input: EventInput,
  target: string,
  deviceTimezone?: string,
): EventInput {
  const timezone =
    target === "system"
      ? resolveTimezone(target, deviceTimezone)
      : canonicalTimezone(target);
  if (!timezone) throw new Error("TIMEZONE_ERROR");
  if (input.allDay) return { ...input, timezone };
  const source =
    input.timezone === "system"
      ? resolveTimezone(input.timezone, deviceTimezone)
      : input.timezone;
  const start = wallTime(input.startDate, input.startTime, source),
    end = wallTime(input.endDate, input.endTime, source);
  if (end <= start) throw new Error("END_BEFORE_START");
  const localStart = inZone(start, timezone),
    localEnd = inZone(end, timezone);
  const converted = {
    ...input,
    timezone,
    startDate: localStart.date,
    startTime: localStart.time,
    endDate: localEnd.date,
    endTime: localEnd.time,
  };
  // The form's first-occurrence policy cannot represent the second repeated DST hour.
  if (
    wallTime(converted.startDate, converted.startTime, timezone) !== start ||
    wallTime(converted.endDate, converted.endTime, timezone) !== end
  )
    throw new Error("TIMEZONE_AMBIGUOUS");
  return converted;
}
export function daySegment(
  event: CalendarEvent,
  day: string,
  timezone: string,
) {
  if (event.allDay)
    return event.startDate <= day && event.endDate >= day
      ? { start: 0, end: 1440 }
      : null;
  const start = inZone(event.startsAt, timezone),
    end = inZone(event.endsAt, timezone);
  if (
    start.date > day ||
    end.date < day ||
    (end.date === day && end.time === "00:00")
  )
    return null;
  const minutes = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return {
    start: start.date < day ? 0 : minutes(start.time),
    end: end.date > day ? 1440 : minutes(end.time),
  };
}
export function layoutEvents(
  events: CalendarEvent[],
  day: string,
  timezone: string,
) {
  const segments = events
    .filter((e) => !e.allDay)
    .map((event) => ({ event, segment: daySegment(event, day, timezone) }))
    .filter((x) => x.segment)
    .map((x) => ({
      event: x.event,
      start: x.segment!.start,
      end: Math.max(x.segment!.end, x.segment!.start + 20),
      lane: 0,
      lanes: 1,
    }))
    .sort(
      (a, b) =>
        a.start - b.start ||
        b.end - a.end ||
        a.event.key.localeCompare(b.event.key),
    );
  let group: typeof segments = [],
    ends: number[] = [];
  const flush = () => {
    for (const item of group) item.lanes = ends.length;
    group = [];
    ends = [];
  };
  for (const item of segments) {
    if (group.length && item.start >= Math.max(...ends)) flush();
    let lane = ends.findIndex((end) => end <= item.start);
    if (lane < 0) lane = ends.length;
    item.lane = lane;
    ends[lane] = item.end;
    group.push(item);
  }
  flush();
  return segments;
}
