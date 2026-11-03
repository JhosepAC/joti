# Workspace notes

Notes is an Operate surface for capturing ideas within a space, as described in `docs/business_context.md`. Open it from the workspace's Notes module (`?module=notes`); `note=<key>` addresses a selected note. It preserves Joti Light and reuses the scoped session bridge, Convex subscriptions, custom selectors/modals, SVG icon library and the Pages Tiptap/Markdown editor. No new dependency or paid service is required.

## Implemented

- Quick capture, blank/checklist/meeting starters, card/list views, pinning, five optional note colors, tags, sort controls and search across titles, preview text and tags.
- Rich text and Markdown source, tasks, headings, tables, code, links, URL images, import/export and printing inherited from the shared editor. Notes have a read-only editor mode in archive/trash.
- Autosave after one second, same-tab session draft recovery, revision checks, retryable operation receipts and unload warnings. Drafts are keyed by authenticated owner, space and note. Save failures retain the input; conflicts offer export and explicitly loading the saved version. Session storage is a recovery aid, not the persistence backend or a full offline queue.
- Up to ten previous saved revisions with restoration as a new revision, duplicate, archive/restore, recoverable trash and confirmed permanent deletion. Permanent deletion also removes the catalog entry and version records. Trash is retained until explicitly deleted.
- Related notes derived from overlapping user tags, not AI or external recommendations. Converting a note to a page copies saved content once and records its page link; the original note remains. Later note edits do not update the independent page. A deleted destination can be recreated through the same action.
- Keyboard `N` for a new note outside editors and `Ctrl/Cmd+K` for search; editor shortcuts remain available. Reduced motion is respected. Modals restore focus to the triggering element when it remains mounted.

## Data and permissions

The additive schema creates `space_notes` (content), `note_catalog` (lightweight metadata and a 240-character preview), `note_versions` and `note_operations`. There is no existing-data migration or backfill. The catalog keeps subscriptions bounded without returning every note body; selected content/history loads only for that note. Limits: 500 notes per space, 30,000 body characters, a 120-character title and twelve unique tags of thirty characters. Permanent deletion never deletes an independently converted page.

`/api/lists/access` is the historical name of the shared space-grant bridge. `notes/data` reuses `lists/access.authorize` to check the current verified user, durable session and ownership on every read/write. Spaces currently support owners only; no new sharing model is implied. Stale revisions cannot overwrite newer content. Receipts bind payload hashes to operation IDs for seven days; a daily cron cleans old receipts. Create keys additionally prevent duplicate live notes. These limits and guarantees match the existing calendar/list architecture.

When another tab deletes an open note, its editor keeps a copy in memory and communicates that it is gone, allowing export/discard of pending work. This is not CRDT collaborative editing. Links/images use the shared editor's existing URL behavior; attachment uploads, reminders and external AI are outside this module.

## Validation and deployment

Run `pnpm --filter web test` (including `tests/auth/notes.test.ts`), web lint, workspace type checks, `node scripts/i18n-check.mjs`, and the web build. Sync the additive schema/functions with the project's normal Convex development or deployment command. The browser review uses an isolated temporary account/space on development and cleans it afterward; no review fixture function or sample note ships with the module.
