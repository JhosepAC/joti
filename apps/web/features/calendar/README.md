# Calendar

`CalendarModule` is mounted at `/w/[slug]?module=calendar`. It reuses the workspace shell, Nook Light tokens, list controls (`DatePicker`, searchable `ListSelect`), accessible `Modal`, and existing Convex provider. No new package or external service is required.

## Data and authorization

The additive schema introduces `calendar_events` and `calendar_operations`. Events belong to `spaces` and carry a stable key and revision. Receipt hashes make identical retries idempotent for seven days, including deletion; conflicting reuse is rejected. A daily cron removes old receipts. After receipt expiry, retries against an existing event key are rejected. Deleting an event removes its key reservation, so the seven-day receipt window is the guarantee for replaying old create/delete requests.

The existing `/api/lists/access` bridge issues a space grant, reused by calendar queries/mutations through `lists/access.authorize`. Despite its historical name, this grant validates the current HttpOnly session, verified account and space owner on every operation. No separate calendar authentication or persistence was introduced. Current spaces support owners only; shared memberships are not implemented in the repository.

`watch` subscribes to a bounded visible date range with a timezone guard. The space is capped at 2,000 events, permitting a bounded per-space read. Convex subscriptions update other authorized tabs immediately. Stale revisions cannot overwrite or delete newer events. Forms retain input on failure and reuse the operation ID when retrying the same payload. Offline writes fail early; an interrupted request exits its pending state after 15 seconds. A delayed write may still succeed, and retry receipts prevent duplication. Unsaved forms are not an offline queue.

## Date contract

- Supported event dates: 1900–2100. Grid padding may extend into adjacent years.
- All-day start/end dates are **inclusive**, date-only, and never shifted with the viewer's timezone. UTC indexes for them are bookkeeping, not display values.
- Timed events save their IANA timezone, local date/time inputs and derived UTC instants. Display uses the viewer's chosen timezone; details show the event's original timezone. Midnight endings exclude the following day.
- A profile preference of `system` resolves to the browser's timezone. Invalid or missing profile zones also fall back to the browser, then UTC. Event writes always use a concrete zone: the backend rejects unresolved `system` to avoid interpreting it in the server's timezone. Changing an event's zone converts its dates and times while preserving UTC instants; all-day dates remain unchanged. Conversions into an unrepresentable second repeated DST hour are rejected rather than silently rescheduling the event.
- `wallTime` round-trips candidate offsets using Intl, rejects nonexistent DST times and chooses the **first occurrence** of repeated wall-clock hours. The form explains this policy. Selecting the second repeated occurrence is not supported.
- Weeks start Monday, matching the existing date picker. Navigation uses date-only UTC noon arithmetic, avoiding browser timezone and DST shifts.
- Duration is drawn with wall-clock minutes on a 24-hour grid; a DST transition day does not add/remove a visual hour row. Short events receive a minimum visual height. Overlap lanes account for this height; the agenda preserves every event's full title and times.

## UI and validation

Month cells show three events plus a more indicator. Mobile month cells show counts with an agenda for the selected date. Weekly mobile view uses a compact date strip and agenda; daily keeps its timeline. All-day events stay above the scrolling hours, capped at three plus a more indicator. Color filters and text search apply to every view. Arrow keys navigate month dates and time slots. Deletion requires confirmation.

Tests: `pnpm --filter web test` includes `tests/auth/calendar.test.ts` for CRUD, retries, revisions, isolation, revoked sessions, leap months, year changes, DST, multi-day ranges and overlap layout. Standard lint, types, build and translation parity checks apply.

## Deployment

Run `pnpm exec convex dev --once` from `apps/web` for development, or the existing Convex deployment workflow in the target environment. This creates the two empty tables and indexes and installs the receipt cron; **no existing records need migration or backfilling**. Do not deploy temporary browser-review fixtures. External calendars, recurrence, invitations, reminders and drag scheduling are intentionally excluded from this release.
