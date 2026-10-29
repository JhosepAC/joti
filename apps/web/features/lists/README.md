# Lists

The workspace's Lists module stores typed tables in Convex. It uses the existing account session; no additional API key or external service is required. Run `pnpm dev:backend` alongside `pnpm dev` from the repository root. `pnpm --filter web exec convex dev --once` synchronizes a one-off backend update.

## User behavior

- Create an empty table or start with tasks, shopping, or packing properties. Templates never insert sample records.
- Edit names, descriptions, icons, cell values, and record notes. Changes save automatically.
- Drag property grips and row grips to reorder. Resize headers by dragging their edge. Property grips also support Alt + Left/Right; resize handles support Left/Right. Properties exposes button alternatives.
- Add typed properties, edit option labels and colors, hide properties per view, and archive/restore them. Retiring a selection option preserves existing values and supports restoration. The primary title remains present. Type changes convert data atomically or reject the change without discarding values.
- Supported properties include title, text, number, checkbox, select, multiple selection, status, date, URL, email, phone, currency, percentage, and rating. Currency properties have a configurable unit; percentages accept 0–100 and ratings 0–5.
- Use custom searchable controls and a keyboard-operated calendar throughout the module; property, filter, sort, color, month, and year menus use the same control system.
- Save views with AND/OR filters, ordered sorts, grouping, text wrapping, and per-column calculations (count, sum, average, minimum, maximum, checked). Edit the current view through the list's menu; double-click its tab as a shortcut.
- Search, select records, duplicate, archive, undo, or restore archived records. Manual row ordering is available when sorting/grouping are inactive.
- Update a property across selected records atomically, duplicate a selection, select matching results across pages, and select ranges with Shift. The compact selection gutter is independent of property columns.
- Each sidebar item exposes favorites, duplicate, rename, and an exact link for opening it in a new tab. List duplicates include properties, views, records, and record notes; subsequent edits remain independent. Sidebar page actions use the same menu treatment.
- Import CSV as a new table with text properties and a primary title. Export the visible filtered/sorted view. TSV paste updates existing cells; it validates the entire paste before writing.

## Persistence and authorization

`list_catalog` keeps sidebar summaries separate from property configuration, so opening one table does not read every other table's full schema. For deployments with early list records, run the internal `lists/maintenance:backfillCatalog` mutation with `{ "cursor": null }`, then its returned cursor until `done` is true. New lists maintain this catalog transactionally.

`/api/lists/access` exchanges the HttpOnly session cookie for a ten-minute, space-scoped ticket. Convex stores only ticket hashes, checks session revocation and space ownership on every operation, and provides reactive query subscriptions.

Mutations use client operation IDs for deduplication. Cell versions let edits to different cells merge while rejecting conflicting edits to the same cell. List configuration uses revisions. Failed operations remain visible with explicit retry or discard controls; applying a stale change requires the user's choice.

The pending queue is saved in tab session storage before navigation. After an interrupted connection it retries through Convex. This is not an offline-first database: opening an uncached workspace requires a connection, and closing a tab discards its session storage. Keep the tab open until “Guardado” appears. The workspace keeps the module mounted after visiting it so navigation does not interrupt pending writes.

## Bounds and verification

Each space supports 100 lists, each list 1,000 records including archived records, 40 active properties, and 12 views. Results display 50 records per page; filters and sorting apply across the full bounded list. Text cells allow 2,000 characters, with UTF-8 budgets for complete records. Archival is reversible. Permanent list and record deletion requires explicit confirmation; deleting a list cascades to its archived records and catalog entry. Invitations, formulas, and additional view layouts are outside this module.

On small screens the primary title displays first to keep record identity readable, while desktop retains the user's saved property order. Other properties remain available through horizontal scrolling.

Run `pnpm --filter web test` for backend authorization, atomicity, conflict, CSV, template, and session-boundary regressions. Tests stay under `tests/auth/` to match the existing Vitest discovery configuration.
