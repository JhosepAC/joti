"use client";

import {
  clearGrants,
  storeAccountGrant,
  type AccountGrant,
} from "./claim-store";

/** The browser never sees the durable session token; the route sets an HttpOnly cookie. */
export async function establishSession(
  email: string,
  token: string,
): Promise<AccountGrant> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
    credentials: "same-origin",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Session unavailable");
  const grant = (await response.json()) as AccountGrant;
  clearGrants();
  storeAccountGrant(grant.email, grant.token);
  return grant;
}

export async function resumeSession(): Promise<AccountGrant | null> {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Session unavailable");
  const grant = (await response.json()) as AccountGrant | null;
  if (grant) storeAccountGrant(grant.email, grant.token);
  return grant;
}
