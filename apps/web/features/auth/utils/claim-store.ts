"use client";

/**
 * Carries a claim grant between the steps that rotate it.
 *
 * Durable sessions live in an HttpOnly cookie. These narrow, short-lived
 * grants carry authorization between existing Convex operations.
 * `sessionStorage` is used rather than a query parameter on purpose: a URL ends
 * up in browser history, `Referer` headers and server logs, and this token
 * authorises writing to an account.
 *
 * Two scopes live here under separate keys:
 *   - `account` — from sign-in / code redemption / profile completion. Carries
 *     the address it is bound to, since the next step needs to know whose
 *     account it is finishing.
 *   - `space`   — bound to one space, issued once a space exists. Authorises
 *     rendering `/w/<slug>`; the server checks the binding, so the client only
 *     needs to know which slug it was issued for.
 *
 * Separate keys (not one slot) so entering a workspace never destroys the
 * account grant and vice versa: with a single slot, storing the space grant
 * logged the onboarding out mid-flow, and re-signing in killed the open
 * workspace. Grants are short-lived (15 min) and single-use, so the exposure
 * window is small. The durable session can mint fresh account proof on sign-in.
 */

const ACCOUNT_KEY = "joti:claim:account";
const SPACE_KEY = "joti:claim:space";

export interface AccountGrant {
  email: string;
  token: string;
}

interface StoredAccountGrant {
  email: string;
  token: string;
}

interface StoredSpaceGrant {
  token: string;
  slug: string;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full quota: the next screen will ask them to sign in
    // again, which is the correct failure mode.
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/** Stores the grant that authorises the next onboarding step. */
export function storeAccountGrant(email: string, token: string): void {
  writeJson(ACCOUNT_KEY, {
    email: email.trim().toLowerCase(),
    token,
  } satisfies StoredAccountGrant);
}

/** Stores the grant that authorises `/w/<slug>` for one space. */
export function storeSpaceGrant(slug: string, token: string): void {
  writeJson(SPACE_KEY, { token, slug } satisfies StoredSpaceGrant);
}

/** Reads the `account` grant without consuming it, so a reload can resume. */
export function readAccountGrant(): AccountGrant | null {
  const parsed = readJson(ACCOUNT_KEY) as Partial<StoredAccountGrant> | null;
  if (
    !parsed ||
    typeof parsed.email !== "string" ||
    typeof parsed.token !== "string"
  ) {
    return null;
  }
  if (parsed.token.length === 0) return null;
  return { email: parsed.email.trim().toLowerCase(), token: parsed.token };
}

/** Reads and clears the `account` grant. */
export function takeAccountGrant(): AccountGrant | null {
  const grant = readAccountGrant();
  if (!grant) return null;
  remove(ACCOUNT_KEY);
  return grant;
}

/** Reads the `space` grant issued for `slug`, without consuming it. */
export function readSpaceGrant(slug: string): string | null {
  const parsed = readJson(SPACE_KEY) as Partial<StoredSpaceGrant> | null;
  if (!parsed || typeof parsed.token !== "string" || parsed.slug !== slug)
    return null;
  return parsed.token;
}

/** Drops every stored grant (both scopes). Call on logout. */
export function clearGrants(): void {
  remove(ACCOUNT_KEY);
  remove(SPACE_KEY);
}
