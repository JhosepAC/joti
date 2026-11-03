# Gmail transactional delivery and security review

## Deployment required

The fixed sender is `Joti <jhosepjamil@gmail.com>`. Enable Google 2-Step Verification, generate an App Password for Joti, and store the 16-letter value as `GMAIL_APP_PASSWORD` in the Convex deployment environment settings. Do not use the normal Google password, put it in `NEXT_PUBLIC_*`, commit it, paste it into chat, or put the secret directly in a shell command/history. Rotate it by updating the deployment secret and revoking the old App Password. Development and production deployments each need configuration. Old Resend variables are unused and can be removed.

Set `NEXT_PUBLIC_APP_URL` in Convex to the application's HTTPS origin (HTTP permitted only on localhost). Keep `EMAIL_CODE_PEPPER` and the existing authentication/session secrets. Deploy web and backend together. No Google sign-in option is added.

## Controls reviewed and implemented

- Only purpose-specific verification, reset and password-change templates call the private transport helper; no generic public mail action. User input cannot choose sender, SMTP host, headers, attachments or content templates.
- SMTP to smtp.gmail.com:465 with certificate verification, minimum TLS 1.2, bounded connection/greeting/socket timeouts, no connection pool, no automatic retries and no debug logging. URL/file content reads are disabled. Connections close after each attempt, including failures.
- Single validated recipient and structured mailbox/envelope fields prevent recipient-list/header injection. Errors logged are fixed strings without addresses, codes, links, credentials or provider responses.
- Shared atomic limits: 10 attempts/minute and 200 attempts per fixed 24-hour window per deployment across all purposes/workers, including failed attempts. Existing per-address verification and reset limits remain. These are application safeguards, not Gmail's provider limits. Different deployments sharing a sender have separate budgets.
- Verification issuance additionally enforces cooldown atomically; failure cleanup checks the exact code hash before deletion so an old failed send cannot remove a newer code. Codes use cryptographic randomness, a server-side pepper, expiry and attempt limits; successful verification burns the code.
- Reset links use a trusted configured HTTPS origin and hashed, expiring, single-use tokens. The existing atomic password-reset commit validates ownership and invalidates sessions. Failed delivery removes its token; the request returns the same generic acknowledgement for known/unknown accounts, including provider outages. Password-change notification failure never rolls back a successful password reset.

## Limits and residual risks

SMTP acceptance means Gmail accepted the message, not that it reached an inbox. Gmail can block cloud egress sign-ins, enforce lower quotas or classify mail as spam. A timeout after SMTP acceptance is ambiguous; the app does not retry automatically to avoid duplicate sends. Users request another code after cooldown. Alert delivery is best effort and shares the same budget; there is no durable retry queue.

App Passwords grant substantial access to the Gmail account: a dedicated Joti mailbox is preferable to a personal mailbox. This implementation uses the requested account. Limits bound abuse but do not eliminate it: an attacker rotating recipients can exhaust the global budget. CAPTCHA/edge abuse controls and operational monitoring remain future work; timing differences in recovery requests are not eliminated. This review is scoped to email issuance and the recovery path, not a full penetration test of the application.

## Validation

Regression tests mock SMTP; no real recipient is contacted. Tests cover TLS/options, fixed sender, alternate recipients, missing secret, injection, rejection, timeouts/errors without logging secrets, trusted reset origins, atomic quotas, conditional cleanup, and existing auth/reset behavior. Once configured, manually verify delivery to two controlled addresses, wrong/expired codes, resend cooldown, reset expiry/replay, session revocation and a revoked App Password. Actual Gmail delivery cannot be confirmed without the deployment credential.

## Dependency audit — 2026-11-03

`pnpm audit --prod` reports 14 advisories (3 critical, 5 high, 5 moderate, 1 low) in the existing dependency tree. No advisory was reported for Nodemailer 10.3.1. Reported affected packages include Next.js (critical RCE advisories; audit recommends >=16.4.1), Sharp (>=0.35.5), nanoid (>=3.3.18) and source-map-js (>=1.2.2). These require a separate dependency upgrade and regression pass; this transport change does not resolve them or prove exploitability in Joti. Re-run the audit before production deployment.
