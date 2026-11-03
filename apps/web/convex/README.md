# Joti backend (Convex)

The active backend lives here, under `apps/web/convex/`. It implements email/password authentication and the first-space workflow. Google HTTP endpoints are intentionally not mounted; legacy provider tables and internal helpers remain to preserve existing data.

## Authentication boundary

Public actions validate untrusted input and perform Node-only cryptography. Queries and mutations that read credentials or change account state are internal. `getUserByEmail` is internal; public profile queries return only display fields.

A recent verification timestamp is not authorization. Both `actions.register` and `actions.completeProfile` require an address-bound, unexpired account grant. The write rechecks that grant and consumes it atomically with account/profile creation. Uniqueness or validation failures roll back the write and keep valid proof retryable.

## Sessions and grants

- `auth/sessions.ts`: public session creation, resumption, and revocation actions.
- `auth/sessionStore.ts`: internal atomic storage of SHA-256 session digests. Sessions expire after seven days, with at most ten per account.
- `app/api/auth/session/route.ts` (in the web app): same-origin HTTP bridge that sets the opaque session token in an HttpOnly, SameSite cookie, Secure in production. JSON exposes only short-lived account proof.
- `auth_claim_grants`: address-bound account grants and space-bound grants, valid for 15 minutes. The session bridge does not replace explicit authorization inside Convex operations.

`getEntryContext` rotates account proof and determines whether the next destination is profile completion, the first-space flow, or the user's workspace. `createFirstSpace` and `getWorkspace` require the appropriate proof; a slug or an email alone authorizes nothing. React effect replay shares in-flight requests so one-use proof is not consumed twice.

## Email, passwords, and recovery

Passwords use bcrypt and are accepted only within the configured UTF-8 byte limit. Login failures avoid disclosing account state before password verification and apply lockout/rate limits. Email codes are peppered digests with expiry, attempt limits, and resend quotas. Email/password are not persisted during the initial registration request.

Reset links are random, hashed, one-use, and valid for one hour. Password update, reset-token consumption, lockout reset, and revocation of existing sessions/grants commit in one transaction. Legacy accounts without passwords use this same recovery flow. Unknown-address reset requests answer generically; attempted delivery failures are explicitly reported, rather than claiming mail was sent.

No passwords, raw codes, reset links, or session tokens belong in logs. Configure private email variables on the Convex deployment. See [the authentication guide](../../../docs/authentication.md) for setup, development synchronization, and manual checks.

## Validation

From the repository root: `pnpm --filter web test`, `pnpm check-types`, `pnpm lint`, and `pnpm build`. Tests use an in-process `convex-test` backend and mocked mail transport; they do not contact real recipients. `pnpm exec convex codegen` regenerates local bindings without activating a deployment change. Run `pnpm exec convex dev` from `apps/web` to synchronize the configured development deployment.
