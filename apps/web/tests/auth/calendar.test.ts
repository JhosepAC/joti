import { describe, expect, test } from "vitest";
import { api, internal, sha256Hex, testClient } from "./helpers";
import {
  validateEvent,
  wallTime,
  inZone,
  layoutEvents,
  daySegment,
  canonicalTimezone,
  resolveTimezone,
  convertEventTimezone,
  type EventInput,
  type CalendarEvent,
} from "../../convex/calendar/time";
import { daysFor, navigate } from "../../features/calendar/lib/dates";
const input: EventInput = {
  title: "Project review",
  description: "Notes",
  location: "Studio",
  startDate: "2026-10-29",
  endDate: "2026-10-29",
  startTime: "09:00",
  endTime: "10:00",
  allDay: false,
  timezone: "America/Bogota",
  color: "blue",
};
describe("calendar system timezone regression", () => {
  test("system, missing and invalid profile zones resolve to the device, with UTC as last fallback", () => {
    for (const value of ["system", undefined, "", "Invalid/Zone"])
      expect(resolveTimezone(value, "America/Bogota")).toBe("America/Bogota");
    expect(resolveTimezone("system", "Invalid/Zone")).toBe("UTC");
    expect(resolveTimezone("Asia/Tokyo", "America/Bogota")).toBe("Asia/Tokyo");
    expect(canonicalTimezone(" US/Eastern ")).toBe("America/New_York");
    expect(inZone(Date.parse("2026-10-29T14:00:00Z"), "system")).toEqual(
      inZone(Date.parse("2026-10-29T14:00:00Z"), resolveTimezone("system")),
    );
  });
  test("changing zones preserves instants and converts across day boundaries", () => {
    const converted = convertEventTimezone(input, "Asia/Tokyo");
    expect(converted).toMatchObject({
      startDate: "2026-10-29",
      startTime: "23:00",
      endDate: "2026-10-30",
      endTime: "00:00",
      timezone: "Asia/Tokyo",
    });
    expect(validateEvent(converted).startsAt).toBe(
      validateEvent(input).startsAt,
    );
    expect(validateEvent(converted).endsAt).toBe(validateEvent(input).endsAt);
  });
  test("automatic event conversion resolves before persistence, never using the server timezone", () => {
    const converted = convertEventTimezone(
      { ...input, timezone: "UTC" },
      "system",
      "America/Bogota",
    );
    expect(converted.timezone).toBe("America/Bogota");
    expect(converted.startTime).toBe("04:00");
    expect(() => validateEvent({ ...input, timezone: "system" })).toThrow(
      "TIMEZONE_ERROR",
    );
    expect(() => wallTime(input.startDate, input.startTime, "system")).toThrow(
      "TIMEZONE_ERROR",
    );
  });
  test("all-day conversion leaves dates unchanged and incomplete titles do not block timed conversion", () => {
    expect(
      convertEventTimezone({ ...input, allDay: true }, "Pacific/Auckland"),
    ).toMatchObject({
      startDate: input.startDate,
      endDate: input.endDate,
      timezone: "Pacific/Auckland",
    });
    expect(convertEventTimezone({ ...input, title: "" }, "UTC").startTime).toBe(
      "14:00",
    );
  });
  test("conversion observes DST and rejects unsupported ambiguous instants without rescheduling", () => {
    const summer = {
      ...input,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      timezone: "UTC",
    };
    expect(convertEventTimezone(summer, "America/New_York").startTime).toBe(
      "05:00",
    );
    expect(() =>
      convertEventTimezone(
        {
          ...input,
          startDate: "2026-11-01",
          endDate: "2026-11-01",
          startTime: "06:30",
          endTime: "07:30",
          timezone: "UTC",
        },
        "America/New_York",
      ),
    ).toThrow("TIMEZONE_AMBIGUOUS");
    expect(() => convertEventTimezone(input, "Invalid/Zone")).toThrow(
      "TIMEZONE_ERROR",
    );
  });
});
function event(key: string, part: Partial<EventInput> = {}): CalendarEvent {
  return { ...validateEvent({ ...input, ...part }), key, revision: 1 };
}
async function fixture() {
  const t = testClient(),
    token = "calendar-session-test-token-1234567890",
    ticket = "calendar-space-test-ticket-1234567890";
  const rows = await t.run(async (ctx) => {
    const user = await ctx.db.insert("auth_users", {
      email: "calendar@example.test",
      email_verified_at: 1,
      failed_login_attempts: 0,
    });
    const session = await ctx.db.insert("auth_sessions", {
      user_id: user,
      token_hash: sha256Hex(token),
      created_at: Date.now(),
      expires_at: Date.now() + 3600000,
    });
    const space = await ctx.db.insert("spaces", {
      owner_id: user,
      name: "Calendar",
      slug: "calendar",
      icon: "🏠",
      purpose: "personal",
      is_private: true,
      created_at: Date.now(),
    });
    return { user, session, space };
  });
  await t.mutation(internal.lists.access.mint, {
    session_hash: sha256Hex(token),
    ticket_hash: sha256Hex(ticket),
    slug: "calendar",
  });
  let sequence = 0;
  const apply = (
    kind: "create" | "update" | "delete",
    key = "event-12345678",
    value: EventInput | undefined = input,
    revision?: number,
    opId = "operation-" + ++sequence,
  ) =>
    t.mutation(api.calendar.events.apply, {
      ticket,
      opId,
      key,
      kind,
      ...(value ? { event: value } : {}),
      ...(revision !== undefined ? { revision } : {}),
    });
  const watch = () =>
    t.query(api.calendar.events.watch, {
      ticket,
      from: "2026-10-01",
      to: "2026-11-11",
    });
  return { t, rows, ticket, apply, watch };
}
describe("calendar persistence and isolation", () => {
  test("converted automatic zones persist as concrete zones with unchanged instants", async () => {
    const f = await fixture();
    const converted = convertEventTimezone(input, "system", "Asia/Tokyo");
    await f.apply("create", undefined, converted);
    const saved = (await f.watch()).events[0]!;
    expect(saved.timezone).toBe("Asia/Tokyo");
    expect(saved.startsAt).toBe(validateEvent(input).startsAt);
    expect(saved.endsAt).toBe(validateEvent(input).endsAt);
  });
  test("create, query, update and delete persist with idempotent request receipts", async () => {
    const f = await fixture();
    await f.apply("create", undefined, input, undefined, "stable-create");
    await f.apply("create", undefined, input, undefined, "stable-create");
    expect((await f.watch()).events).toHaveLength(1);
    await f.apply(
      "update",
      undefined,
      { ...input, title: "Updated" },
      1,
      "stable-update",
    );
    await f.apply(
      "update",
      undefined,
      { ...input, title: "Updated" },
      1,
      "stable-update",
    );
    expect((await f.watch()).events[0]?.revision).toBe(2);
    await f.apply("delete", undefined, undefined, 2, "stable-delete");
    await f.apply("delete", undefined, undefined, 2, "stable-delete");
    expect((await f.watch()).events).toHaveLength(0);
  });
  test("stale writes and reused IDs cannot replace another request", async () => {
    const f = await fixture();
    await f.apply("create", undefined, input, undefined, "same-request");
    await expect(
      f.apply(
        "create",
        undefined,
        { ...input, title: "different" },
        undefined,
        "same-request",
      ),
    ).rejects.toThrow("VALIDATION_ERROR");
    await f.apply("update", undefined, { ...input, title: "Kept" }, 1);
    await expect(f.apply("update", undefined, input, 1)).rejects.toThrow(
      "CONFLICT",
    );
    await expect(f.apply("delete", undefined, undefined, 1)).rejects.toThrow(
      "CONFLICT",
    );
    expect((await f.watch()).events[0]?.title).toBe("Kept");
  });
  test("invalid dates and empty titles do not persist", async () => {
    const f = await fixture();
    for (const bad of [
      { title: " " },
      { startDate: "2026-02-30" },
      { endDate: "2026-10-28" },
      { endTime: "08:00" },
      { timezone: "Invalid/Zone" },
      { color: "purple" },
      { startTime: "25:00" },
    ])
      await expect(
        f.apply("create", undefined, { ...input, ...bad }),
      ).rejects.toThrow();
    expect((await f.watch()).events).toHaveLength(0);
  });
  test("space-scoped grants cannot read, edit or delete another space's event", async () => {
    const f = await fixture();
    await f.apply("create");
    const other = await f.t.run((ctx) =>
      ctx.db.insert("spaces", {
        owner_id: f.rows.user,
        name: "Other",
        slug: "other-calendar",
        icon: "🏠",
        purpose: "personal",
        is_private: true,
        created_at: Date.now(),
      }),
    );
    const otherTicket = "other-calendar-space-ticket-1234567890";
    await f.t.mutation(internal.lists.access.mint, {
      session_hash: sha256Hex("calendar-session-test-token-1234567890"),
      ticket_hash: sha256Hex(otherTicket),
      slug: "other-calendar",
    });
    expect(
      (
        await f.t.query(api.calendar.events.watch, {
          ticket: otherTicket,
          from: "2026-10-01",
          to: "2026-11-01",
        })
      ).events,
    ).toEqual([]);
    await expect(
      f.t.mutation(api.calendar.events.apply, {
        ticket: otherTicket,
        key: "event-12345678",
        kind: "delete",
        revision: 1,
        opId: "foreign-delete",
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(other).not.toBe(f.rows.space);
  });
  test("session revocation blocks reads and mutations", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.delete(f.rows.session));
    expect((await f.watch()).status).toBe("expired");
    await expect(f.apply("create")).rejects.toThrow("UNAUTHORIZED");
  });
});
describe("calendar dates, timezones and layouts", () => {
  test.each([
    "2024-02-15",
    "2025-02-15",
    "2026-04-15",
    "2026-01-15",
    "2100-12-15",
  ])("month grid is contiguous with 42 days: %s", (day) => {
    const days = daysFor(day, "month");
    expect(days).toHaveLength(42);
    expect(new Date(days[0] + "T12:00Z").getUTCDay()).toBe(1);
    for (let i = 1; i < days.length; i++)
      expect(Date.parse(days[i]!) - Date.parse(days[i - 1]!)).toBe(86400000);
  });
  test("navigation rolls years and weeks correctly", () => {
    expect(navigate("2026-12-31", "month", 1)).toBe("2027-01-01");
    expect(navigate("2027-01-01", "month", -1)).toBe("2026-12-01");
    expect(navigate("2026-12-29", "week", 1)).toBe("2027-01-05");
    expect(daysFor("2026-03-01", "week")[0]).toBe("2026-02-23");
  });
  test("timezone conversion preserves wall clocks and rejects nonexistent DST times", () => {
    expect(
      inZone(
        wallTime("2026-10-29", "09:00", "America/Bogota"),
        "America/Bogota",
      ),
    ).toEqual({ date: "2026-10-29", time: "09:00" });
    expect(() => wallTime("2026-03-08", "02:30", "America/New_York")).toThrow(
      "DST_GAP",
    );
    expect(wallTime("2026-11-01", "01:30", "America/New_York")).toBe(
      Date.parse("2026-11-01T05:30:00Z"),
    );
    expect(() => wallTime("2026-03-29", "02:30", "Europe/Berlin")).toThrow(
      "DST_GAP",
    );
  });
  test("all-day events stay on date across all zones and span months", () => {
    const e = event("all-day", {
      allDay: true,
      startDate: "2026-10-31",
      endDate: "2026-11-02",
    });
    expect(daySegment(e, "2026-11-01", "Pacific/Auckland")).not.toBeNull();
    expect(daySegment(e, "2026-11-02", "America/Los_Angeles")).not.toBeNull();
    expect(daySegment(e, "2026-11-03", "UTC")).toBeNull();
  });
  test("midnight end excludes following day and multi-day timed events split", () => {
    const e = event("overnight", { endDate: "2026-10-31", endTime: "00:00" });
    expect(daySegment(e, "2026-10-30", input.timezone)).toEqual({
      start: 0,
      end: 1440,
    });
    expect(daySegment(e, "2026-10-31", input.timezone)).toBeNull();
  });
  test("simultaneous and partial overlaps get lanes; adjacent events reuse space", () => {
    const items = layoutEvents(
      [
        event("one"),
        event("two", { endTime: "11:00" }),
        event("three", { startTime: "10:30", endTime: "11:30" }),
        event("four", { startTime: "12:00", endTime: "13:00" }),
      ],
      input.startDate,
      input.timezone,
    );
    expect(items.slice(0, 3).every((i) => i.lanes === 2)).toBe(true);
    expect(items[3]?.lanes).toBe(1);
    expect(items[0]?.lane).not.toBe(items[1]?.lane);
  });
});
