export function dateKey(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const result = new Date(value + "T12:00:00");
  return Number.isFinite(+result) && dateKey(result) === value ? result : null;
}
export function calendarDays(month: Date) {
  const first = makeDate(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return date;
  });
}
export function makeDate(year: number, month: number, day = 1) {
  const result = new Date(2000, 0, 1, 12);
  result.setFullYear(year, month, day);
  return result;
}
