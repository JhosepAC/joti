"use client";

/**
 * Carries a claim grant between the steps that rotate it.
 *
 * The app has no session, so there is nothing else to hand the token over with.
 * `sessionStorage` is used rather than a query parameter on purpose: a URL ends
 * up in browser history, `Referer` headers and server logs, and this token
 * authorises writing to an account.
 *
 * Two scopes live here:
 *   - `account` — from sign-in / code redemption / profile completion. Carries
 *     the address it is bound to, since the next step needs to know whose
 *     account it is finishing.
 *   - `space`   — bound to one space, issued once a space exists. Authorises
 *     rendering `/w/<slug>`; the server checks the binding, so the client only
 *     needs to know which slug it was issued for.
 *
 * A single slot is enough because the steps are sequential: reaching a space
 * means onboarding is finished, and vice versa. Grants are short-lived (15 min)
 * and single-use, so the exposure window is small. Once sessions exist this
 * whole file should go away.
 */

const STORAGE_KEY = "joti:claim";

export interface AccountGrant {
  email: string;
  token: string;
}

interface StoredGrant {
  email?: string;
  token: string;
  scope: "account" | "space";
  slug?: string;
}

function read(): StoredGrant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredGrant>;
    if (typeof parsed.token !== "string" || parsed.token.length === 0) return null;
    if (parsed.scope !== "account" && parsed.scope !== "space") return null;
    if (parsed.scope === "account" && typeof parsed.email !== "string") return null;
    return {
      email: typeof parsed.email === "string" ? parsed.email.trim().toLowerCase() : undefined,
      token: parsed.token,
      scope: parsed.scope,
      slug: typeof parsed.slug === "string" ? parsed.slug : undefined,
    };
  } catch {
    return null;
  }
}

function write(grant: StoredGrant): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(grant));
  } catch {
    // Private mode or a full quota: the next screen will ask them to sign in
    // again, which is the correct failure mode.
  }
}

function clear(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/** Stores the grant that authorises the next onboarding step. */
export function storeAccountGrant(email: string, token: string): void {
  write({ email: email.trim().toLowerCase(), token, scope: "account" });
}

/** Stores the grant that authorises `/w/<slug>` for one space. */
export function storeSpaceGrant(slug: string, token: string): void {
  write({ token, scope: "space", slug });
}

/** Reads the `account` grant without consuming it, so a reload can resume. */
export function readAccountGrant(): AccountGrant | null {
  const grant = read();
  if (!grant || grant.scope !== "account" || !grant.email) return null;
  return { email: grant.email, token: grant.token };
}

/** Reads and clears the `account` grant. */
export function takeAccountGrant(): AccountGrant | null {
  const grant = read();
  if (!grant || grant.scope !== "account" || !grant.email) return null;
  clear();
  return { email: grant.email, token: grant.token };
}

/** Reads the `space` grant issued for `slug`, without consuming it. */
export function readSpaceGrant(slug: string): string | null {
  const grant = read();
  if (!grant || grant.scope !== "space" || grant.slug !== slug) return null;
  return grant.token;
}

export function clearGrants(): void {
  clear();
}
