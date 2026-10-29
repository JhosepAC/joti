import { addDays } from "@/convex/calendar/time";
export { addDays };
export type CalendarView = "month" | "week" | "day";
export function weekStart(day: string) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function daysFor(day: string, view: CalendarView) {
  const start =
    view === "month"
      ? weekStart(day.slice(0, 7) + "-01")
      : view === "week"
        ? weekStart(day)
        : day;
  return Array.from(
    { length: view === "month" ? 42 : view === "week" ? 7 : 1 },
    (_, i) => addDays(start, i),
  );
}
export function navigate(day: string, view: CalendarView, direction: number) {
  if (view !== "month")
    return addDays(day, direction * (view === "week" ? 7 : 1));
  const date = new Date(day.slice(0, 7) + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + direction);
  return date.toISOString().slice(0, 10);
}
