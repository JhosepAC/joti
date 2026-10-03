# Auth and spaces backend (Convex)

Custom email/password + Google OAuth authentication, plus the first-space
onboarding. This document describes the security model, because most of the code
here exists to enforce it.

## The one rule

> **Anything `export`ed from a file in `convex/` becomes part of the public API
> and is callable by anyone on the internet.**

There is no per-field authorization. A public function's arguments come from
the caller and its return value goes straight to them. So the rule that follows
from this is:

- Anything that touches credential material is an `internalQuery` /
  `internalMutation` / `internalAction`.
- Helpers that are not Convex functions at all (bcrypt, AES encryption, digests)
  are plain `export`ed functions in `_`-prefixed or non-function modules, so they
  are not part of the API surface. `crypto.ts` is imported by actions only.
- `queries.ts` returns a sanitized document. `getUserByEmail` (which *does*
  need `password_hash`) is internal, and `sanitizeUser()` is a second line of
  defence rather than the only one.
- `spaces/mutations.ts` and `spaces/queries.ts` follow the same split: the only
  public function in the feature derives static data from a closed enumeration,
  and every read or write that touches an account is internal.

Files whose name starts with `_` are excluded from the Convex API entirely:
`_codeService.ts`, `_oauthShared.ts`.

## Public surface

Deliberately small, and none of it returns credential material:

| Function | Purpose |
| --- | --- |
| `actions.registerPending` | Wizard step 1 — request a verification code. Stores no password. |
| `actions.register` | Verify address → hash → create user + profile atomically. |
| `actions.completeProfile` | Wizard step 4 / post-login gate. Requires a claim grant. Returns the next grant. |
| `actions.login` | Password check + lockout accounting. Returns a claim grant. |
| `actions.logout` | Best-effort burn of presented grants. Always answers identically. |
| `verification.requestEmailCode` / `resendEmailCode` | Issue and email a code. |
| `verification.confirmEmailCode` | Redeem a code. Returns a claim grant. |
| `passwordReset.requestPasswordReset` | Email a one-time reset link. |
| `passwordReset.resetPassword` | Consume the link, set a new password. |
| `passwordReset.verifyResetToken` | Pre-flight check so the UI can show an expired state. |
| `queries.getPublicProfileByUsername` | Display data only: username, display name, avatar, bio. |
| `storage.generateAvatarUploadUrl` | Mint an upload URL. Requires a claim grant. |
| `oauth/google/authorize`, `oauth/google/callback` | OAuth entry points. |
| `spaces.actions.getEntryContext` | Which stage is this account on? Consumes a grant, returns the next one. |
| `spaces.actions.createFirstSpace` | Onboarding's terminal step. Creates the space, mints a space grant. |
| `spaces.actions.getWorkspace` | Bootstrap for `/w/<slug>`. Requires a grant bound to that space. |
| `spaces.queries.getPurposePreview` | Purpose → template + tools. Static data, no account involved. |

## Spaces

One table, `spaces`, owned by exactly one `auth_users` row. The onboarding
creates the space and records its setup; the items *inside* a space (notes,
tasks, …) are a separate scope and do not exist yet — `/w/<slug>` says so
instead of faking content.

Three decisions worth stating:

- **`purpose` is the only stored setup decision.** Which template seeds the
  space and which tools are enabled is *derived* from it in
  `spaces/templates.ts`, not copied into the row. There is no `template_key` and
  no `tool_keys` column to drift out of sync, and a caller cannot grant
  themselves a tool the product would not have enabled for that purpose.
  `getPurposePreview` is public because that mapping is static data over a
  closed enumeration — it reveals nothing about any account and cannot be used
  as an existence oracle.
- **`slug` is globally unique** (`name`, `name-2`, … up to 50 attempts) because
  `/w/<slug>` has no owner segment: two accounts naming their space the same
  thing must still be addressable. That makes slugs guessable, which is not a
  disclosure — the route renders a space only to a caller holding a grant bound
  to that exact `space_id`, so a guessed slug produces "not available".
- **`icon` and `purpose` are unions in the schema**, so an invalid value is not
  merely rejected but unrepresentable. The allowlists in `spaces/constants.ts`
  and the unions in `schema.ts` are kept in step by the compiler: the insert is
  typed.

`createFirstSpace` is an `internalMutation` on purpose. The caller cannot
supply an owner id — the action resolves the owner from the grant and passes it
down. The guards (account exists, profile is complete, no space yet) live in the
mutation rather than the action because that is the write they have to be atomic
with; Convex mutations are optimistically concurrent, so a check performed one
layer up is a check that can be raced.

**"First space" is enforced, not just named that way.** The mutation refuses once
a space exists, so re-running the flow is idempotent by construction and cannot
be used to farm spaces.

### The entry gate

`getEntryContext` is the single place that decides where an authenticated user
belongs:

| Account state | Result |
| --- | --- |
| no profile | → `/auth/complete-profile` |
| profile, no space | → `/spaces/new` |
| has a space | → `/w/<slug>` for their first space |

Keeping the rule in one function is the point: the alternative is each screen
re-deriving "does this account have a profile, and a space?", which is exactly
the kind of check that drifts and lets someone reach a screen they should not.
It doubles as the server-side defence for `/spaces/new` — reaching that URL
directly is not enough, the gate sends the user back to the right place.

### Rotating grants

`auth_claim_grants` carries a `scope` (`account` | `space`) and an optional
`space_id`. Every entry point **rotates** the grant it is given: it consumes the
caller's token and returns a fresh one for whatever comes next.

| Call | Consumes | Returns |
| --- | --- | --- |
| `completeProfile` | `account` | `account` (for the space step) |
| `getEntryContext` | `account` | `account` or `space` (bound to a `space_id`) |
| `createFirstSpace` | `account` | `space` (bound to the new `space_id`) |
| `getWorkspace` | `space` | `space` (rebound to the same space) |
| `generateAvatarUploadUrl` | nothing — `peek` only | nothing |

So a token captured during one step cannot be replayed against a later one, and
a token scoped to a space cannot be used to finish a profile or create another
one. `issue` clears every grant for the same `(scope, email)`, which also bounds
the table to one row per pair.

Two ordering details that are easy to get backwards:

- `createFirstSpace` **peeks** rather than consumes, and burns the grant only
  after the space exists. A validation failure therefore leaves the user able to
  fix the form and retry, instead of stranding them with a dead token.
- `getWorkspace` consumes **before** it mints. `issue` clears prior grants for
  the same `(scope, email)`, so minting first and consuming second would delete
  the row that was just written.

## Claim grants

The app has no session layer, so there is no identity for Convex to authorize
against. Without a substitute, "authorization" reduced to *knows a verified
email address* — and addresses are public. Concretely, that let anyone who knew
one mint avatar upload URLs against it, and claim the profile of a registered
account that had not finished onboarding.

`auth_claim_grants` is that substitute. A grant is:

- issued **only** after a successful password check (`actions.login`) or a
  successful code redemption (`verification.confirmEmailCode`) — i.e. only after
  the caller has actually proved they control the address;
- stored as a SHA-256 digest, so a database dump yields nothing usable;
- bound to one email address, one scope and short-lived (15 minutes);
- single-use: the step it was issued for consumes it, and mints its successor.

`storage.generateAvatarUploadUrl` validates the grant without consuming it,
because the wizard needs it twice (avatar upload, then profile submit). That
step is separately rate limited to 10/hour per account.

The client carries the grant in React state during a step, and in
`sessionStorage` across redirects (`features/auth/utils/claim-store.ts`). Not a
URL parameter: URLs end up in history, `Referer` headers and server logs.

**This is a mitigation, not a session.** It proves possession of an address, not
a continuing authenticated identity.


## Registration ordering (important)

The account row is **not** created at wizard step 1.

The original code inserted `auth_users` with the password at step 1, before the
address was proven. That is an account-takeover primitive: an attacker
pre-registers `victim@example.com` with a password of their choosing, the
victim receives the code and enters it, and the code "verifies" whichever
password was written last — the attacker's.

The flow is now:

1. `registerPending({ email, password? })` — validates the password for fast
   feedback, then **throws it away** and emails a code.
2. `confirmEmailCode({ email, code })` — proves control of the address and burns
   the code.
3. `completeProfile({ ..., password })` — commits the password and creates the
   user + profile in one mutation.

The password is only ever persisted by the same call that creates the account,
so whoever holds the code is the only party who can set it.

## Enumeration

No endpoint reveals whether an address is registered.

- `requestEmailCode` / `resendEmailCode` / `registerPending` return an identical
  shape for every address, with no `alreadyRegistered` flag.
- `requestPasswordReset` always returns `{ sent: true }`.
- `login` returns one generic `Invalid email or password.` for a missing
  account, a wrong password, or a deactivated account. The "locked" and "not
  verified" messages are only reachable **after** the password is correct, so
  they cannot be used as an oracle. The `!password_hash` branch (OAuth-only
  account) does leak that the address exists — it is reached only when the
  caller supplies a password, and closing it fully requires sessions.
- The send paths are bounded instead: 60s cooldown and 5/hour per address.

## Rate limiting

`rateLimit.ts` is a fixed-window limiter over the `auth_rate_limits` table.
Every unauthenticated, expensive, or email-sending entry point consumes from it
**before** doing the expensive work, so none of them can be used as a free
bcrypt CPU burner or a mail relay.

| Key | Limit | Window |
| --- | --- | --- |
| `verify-email:<email>` | 5 | 1 hour (+ 60s cooldown) |
| `register:<email>` | 5 | 1 hour |
| `complete-profile:<email>` | 5 | 1 hour |
| `login:<email>` | 20 | 1 hour |
| `reset-password:<email>` | 5 | 1 hour |
| `avatar-upload:<email>` | 10 | 1 hour |

Account-level brute force is handled separately by the lockout in
`mutations.handleFailedLogin` (5 failures → 15 minutes).

## Verification codes

- Generated with `crypto.randomInt` (CSPRNG), 6 digits, 10-minute expiry.
- Stored **only as a peppered SHA-256 digest** (`code_hash`, see
  `auth/crypto.hashEmailCode`). A database dump or a log entry therefore does
  not hand out live codes, and the digest cannot be brute-forced offline
  without the server-side `EMAIL_CODE_PEPPER`. The legacy plaintext `code`
  column is still readable so existing rows keep working, and the next issuance
  migrates them. Rows issued just before the pepper was introduced verify
  through a short grace-period digest and are migrated on re-issue.
- Compared in constant time (`constantTimeEqual` in `verificationInternal.ts`).
- 5 wrong guesses per issued code; the counter resets only when a new code is
  issued.
- Burned on success, so a captured request cannot be replayed.
- Never logged. `_codeService.issueVerificationCode` is the only place the
  cleartext code exists, and it hands it straight to the emailer.

`verificationInternal.ts` runs in the V8 isolate, so it must not import
anything touching `node:*`. The hashing therefore happens in the Node action and
the digest is passed in as an argument.

## OAuth

`/oauth/google/authorize` and `/oauth/google/callback` replace the previous
`actions.linkOAuthAccount`, which was a public action with no authentication
that accepted an arbitrary `userId` and a caller-supplied `providerAccountId` —
anyone could attach a Google identity to someone else's account. It also stored
tokens in cleartext despite the columns being named `*_encrypted`.

The replacement derives every value from Google's own response:

- `state` is HMAC-signed (`_oauthShared.createSignedState`) and re-verified in
  constant time, which is what blocks login CSRF.
- The authorization code is exchanged server-to-server with the client secret.
- `sub` and the email come from Google's `tokeninfo` endpoint over TLS, never
  from the query string. `aud` must equal our client id, `iss` must be Google,
  and `email_verified` must be true.
- Tokens are encrypted with AES-256-GCM before storage. `encryptToken` throws if
  `TOKEN_ENCRYPTION_KEY` is missing or is not exactly 32 bytes — the earlier
  version returned the plaintext unchanged when the key was absent, and
  zero-padded short keys, so a misconfiguration silently produced
  unencrypted or weakly-keyed storage.

**Known gap:** linking requires an existing account, and the app has no session
layer, so a completed Google sign-in currently redirects back to the login page
without establishing a session. See *Outstanding work*.

## Avatar uploads

`generateAvatarUploadUrl` was `args: {}` with no auth and no limit, so anyone
could mint unlimited upload URLs and run up the storage bill. It now requires a
claim grant, is rate limited to 10/hour per account, and is backed by a global
ceiling on stored objects.

It is an `action` that hashes the grant and delegates to
`storageInternal.mintAvatarUploadUrl`, because Convex storage is only reachable
from the mutation runtime while hashing needs Node.

## Runtime boundaries

Convex runs two runtimes and they are not interchangeable:

- **V8 isolate** — `query`, `mutation`, `internalQuery`, `internalMutation`.
  No `node:*` imports, so no `bcryptjs`, no `node:crypto`.
- **Node** — `action`, `internalAction`, `httpAction`. Marked with `"use node"`.

The practical rule this repo follows: **mutations never do crypto.** Hashing and
bcrypt happen in the action layer and the result is passed down as an argument.
That is why `verificationInternal.verifyCode` takes a pre-computed `code_hash`,
and why the avatar upload is split across an action and an internal mutation.

Files whose name starts with `_` are excluded from the Convex API entirely:
`_codeService.ts`, `_oauthShared.ts`.


## Outstanding work

1. **No sessions.** `login` returns the user object, a claim grant, and nothing
   else; there is no token, no cookie, no `ctx.auth.getUserIdentity()`. This is
   the root blocker for real authorization — `getCurrentUser` had to be made
   internal because a public version was an IDOR, and the claim grant above is a
   mitigation rather than a fix. Until sessions exist, authorization here means
   "recently proved control of an address", nothing more.
2. **Grants expire while the user is active.** A grant lives 15 minutes and
   `getWorkspace` rotates it on every read — but only on a read. A tab left open
   on `/w/<slug>` for more than 15 minutes without reloading holds a token that
   has expired server-side, so the next request fails with "this session is no
   longer valid". A session, or a refresh-on-focus ping, is the fix; neither
   exists yet, so the workspace currently treats expiry as a sign-in prompt.
   The onboarding steps are unaffected: they are a single forward march, and each
   one mints its successor's grant.
3. **`_generated/` is committed to git.** Convex supports both patterns;
   committing it is fine and `npx convex dev` keeps it in sync. Not changed.
4. `sweepRateLimits`, `deleteExpired` and `claimGrants.clearByEmail` exist but
   nothing calls them on a schedule. Add a cron so those tables do not grow
   unbounded.
5. The `!password_hash` branch in `login` still reveals that an address belongs
   to a Google-only account. Reaching it requires supplying a password, and
   closing it fully means having a session to fall back to.
6. **The Google callback cannot hand a grant to the browser.** It redirects to
   `/auth/login?oauth=success`, but a grant issued in the callback would have to
   travel as a URL parameter to reach the client — which is exactly what the
   claim store avoids. So a Google-only sign-in lands on the login form with no
   way in. Solved by sessions, not by a workaround.


## Commands

```bash
npx convex dev            # push functions + regenerate types
npx convex codegen        # regenerate _generated without deploying
npx convex env set KEY v  # set a server-side env var on the deployment
```

## Deployment prerequisites

`npx convex dev` against a deployment that has never run these functions will
fail at runtime, not at push time:

```bash
npx convex env set TOKEN_ENCRYPTION_KEY <64 hex chars>   # 32 bytes, or encryptToken throws
npx convex env set EMAIL_CODE_PEPPER    <32+ char secret> # pepper for verification-code digests
npx convex env set OAUTH_STATE_SECRET   <32+ char secret> # HMAC key for OAuth state (independent)
npx convex env set NEXT_PUBLIC_APP_URL  <app origin>      # e.g. http://localhost:3002 in dev
npx convex env set GOOGLE_CLIENT_ID     <client id>
npx convex env set GOOGLE_CLIENT_SECRET <client secret>
npx convex env set RESEND_API_KEY       <api key>
```

Google's authorized redirect URI must be
`https://<deployment>.convex.site/oauth/google/callback`, and
`NEXT_PUBLIC_APP_URL` on the deployment has to match the web origin the callback
redirects back to.
