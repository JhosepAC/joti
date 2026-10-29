# Pages

Pages are private workspace documents. The Tiptap editor stores Markdown in the existing `space_pages.body` field, so previous plain text remains editable. React renders the editor schema rather than injecting stored HTML.

## Writing

- Use the toolbar or `/` in an empty paragraph for headings, lists, nested tasks, quotations, fenced code, dividers, tables, links and images.
- Common Markdown input shortcuts and platform shortcuts for bold, italic, undo and redo work in the visual editor. `Ctrl/Cmd+S` saves immediately.
- Markdown mode edits the source directly. Switch to the visual editor to import `.md` or `.txt` at the selection; import is disabled in source mode. Export includes the title. Images use external HTTP(S) URLs and require alternative text. Image file uploads are not included.
- Click inside a table to add or remove rows and columns. The outline navigates document headings. Print uses the browser's print/PDF workflow.
- Content grows vertically within the workspace scroll area; the reading column remains horizontally bounded. Storage currently supports 30,000 characters per document and 200 pages per space. Oversized content stays editable and exportable with a visible warning.

## Persistence and safety

Drafts autosave after 1.2 seconds of inactivity, including when navigating between pages. Session storage recovers unsaved drafts in the same browser tab; unload warns when drafts remain. Failed saves retain drafts and expose the existing retry/save control. Revision checks reject stale writes from other tabs; this is not simultaneous collaborative editing.

Each draft retains its original `baseRevision` through edits and recovery. If typing continues during a successful save, the newer text remains in the draft and its base advances to the saved revision. Legacy drafts without a revision require conflict recovery rather than silently overwriting server content. The conflict dialog exports the local draft and offers an explicit action to replace it with the saved server version.

Icons and favorites persist independently from content revisions. Duplicates copy the saved content and icon. Permanent deletion requires confirmation and the current revision; all operations validate the durable session and workspace owner on the backend.

Run `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web check-types`, and `node scripts/i18n-check.mjs` from the root. Backend regression tests live in `tests/auth/dashboard.test.ts`.
