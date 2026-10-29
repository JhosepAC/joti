# Account settings

Settings opens as a modal from the gear icon in the workspace account footer, preserving its route and mounted modules. The legacy `/settings` URL renders the same dialog. The account API uses the existing HttpOnly session and server-side Convex actions. User IDs are derived from the session, never accepted from the browser. Mutations reuse the existing username/display-name validators and transactional uniqueness check.

The bounded dialog has internal scrolling, sidebar navigation on desktop and horizontal tabs on mobile. Escape, the close button and backdrop clicks protect unsaved changes with confirmation. Closing returns focus to the workspace trigger. The native modal makes background content inert. Motion respects reduced-motion preferences. The account footer keeps a fixed square avatar clipped to a circle, truncated identity text, and labelled settings/sign-out icon buttons.

Implemented: profile details, display name/username editing, registration date, avatar preview/upload/removal, persistent locale, session listing and individual/other-session revocation, the existing password-reset email flow, and sign-out with an unsaved-change warning. Workspace profile details refresh through a local event/BroadcastChannel; the saved locale is restored when establishing a new login session.

Avatar uploads accept PNG/JPEG/WebP up to 512 KiB. The server checks magic bytes, size, session and upload quota. Files use Convex Storage, not database base64. The internal attachment mutation is inaccessible to public callers, and replacement/removal deletes previously managed files. Failed attachment deletes the new file. Existing legacy avatar URLs/files remain compatible; they are not deleted because their ownership cannot be proven by this flow. A new optional `auth_user_profiles.managed_avatar_id` records ownership for future replacements. No data backfill is required.

Security settings reuse `auth/passwordReset.requestPasswordReset`; delivery requires the existing Resend configuration and the existing reset route handles password validation, hashing and session revocation. This screen never receives passwords. Revoking other sessions also burns outstanding account grants, and access grants are invalidated through their session relationship. Sessions show actual creation/expiry values; device names and locations are not invented.

The email identifier is read-only: no verified email-change flow exists. Account deletion is explicitly disabled until a retention policy and a bounded cleanup of every owned space, page, list, event, credential and storage file are designed and verified. These are real limitations, not implemented operations.

Available preferences match the product: Spanish/English is persisted and applied; light appearance, device timezone and Monday week start describe current behavior. Dark themes, notification switches and timezone overrides are not presented as working preferences.

Development: run the existing Convex sync command to add the optional field and account functions. No new external service, secret or dependency is needed. Tests live in `tests/auth/account.test.ts`; run the standard web tests, lint, types, build and translation parity checks.
