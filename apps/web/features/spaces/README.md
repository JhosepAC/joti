# Space configuration

Owners can update the name (3–50 characters), description (280 characters), preset icon, and enabled tools through the workspace configuration modal. Settings persist on the space document through the same-origin workspace bridge and durable owner session. The slug remains stable when renaming, preserving links.

Modules are opt-in. Missing `enabled_modules` is treated as an empty selection, including older spaces. Disabling a module hides its navigation without deleting records or revoking access to owned media referenced in documents. Re-enabling restores the existing content. Templates remain available; their documents are accessible after enabling Pages.

Home presents selected tools and recent documents when Pages is enabled. It does not generate activity or statistics. Module configuration is workspace-wide rather than a browser preference.
