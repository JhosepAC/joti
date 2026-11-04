# Space configuration

Owners can update the name (3–50 characters), description (280 characters), preset icon, and enabled tools through the workspace configuration modal. Settings persist on the space document through the same-origin workspace bridge and durable owner session. The slug remains stable when renaming, preserving links.

Modules are opt-in. Missing `enabled_modules` is treated as an empty selection, including older spaces. Disabling a module hides its navigation without deleting records or revoking access to owned media referenced in documents. Re-enabling restores the existing content. Templates remain available; their documents are accessible after enabling Pages.

Home presents selected tools and recent documents when Pages is enabled. It does not generate activity or statistics. Module configuration is workspace-wide rather than a browser preference.

## Space rail

Favorites, background hex colors and the order of owned active spaces are persisted by the owner-authorized configuration bridge. Right click, Shift+F10 or the options button opens the context panel. Alt+Up/Down and move buttons provide alternatives to dragging. A destination marker, reduced-motion-aware FLIP transition and failure rollback support ordering. Next.js pending navigation shows an indicator after 180 ms.

Icon changes reuse the private media picker and optimized 256 px / 128 KiB WebP upload pipeline. Empty background restores the default. The active outline and side marker sit outside custom colors; dark colors use light vector icons.

Recorded activity covers space metadata, icon and page edits. It is not a cross-module audit log: list, note, calendar and Gallery content edits are not aggregated. Older spaces without recorded edits show an explicit empty state. The author is the owner, the only editor in the current permission model.
