/**
 * Google OAuth helpers.
 *
 * SECURITY: the underscore prefix keeps this module out of the Convex public
 * API, so none of it is remotely callable. Every value used to create or link an
 * account is derived from Google's own token response -- never from a
 * client-supplied `userId` or `providerAccountId`. That is what the removed
 * `actions.linkOAuthAccount` got wrong.
 *
 * RUNTIME: no `"use node"`, deliberately. Both callers are `httpAction`s, and an
 * `httpAction` always runs in the V8 isolate, which has no `node:crypto`. The
 * HMAC and the nonce therefore use Web Crypto (`crypto.subtle`,
 * `crypto.getRandomValues`), which exists in both runtimes -- so the same
 * signing code serves the isolate here and the Node actions unchanged. Marking
 * this file `"use node"` makes the push fail outright; marking the callers
 * `"use node"` is not even legal, since only actions may live in a Node file.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

export type GoogleClaims = {
  sub: string;
  email: string;
  // The tokeninfo endpoint returns this as the string "true"/"false" in some
  // responses and as a boolean in others, so both are accepted.
  email_verified: boolean | string;
  aud: string;
  iss: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is not configured.`);
  }
  return value.trim();
}

export function getGoogleClientId(): string {
  return requireEnv("GOOGLE_CLIENT_ID");
}

function getStateSecret(): string {
  // Independent secret on purpose: sharing GOOGLE_CLIENT_SECRET between
  // Google confidential-client auth and login-CSRF HMAC would couple two
  // purposes to one key (a Google-secret rotation would silently rekey CSRF
  // protection, and vice versa). Fail closed like the other key material.
  return requireEnv("OAUTH_STATE_SECRET");
}

// --- base64url, without Buffer ---------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(standard + "=".repeat((4 - (standard.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// --- CSRF `state` (stateless, HMAC-signed) ---------------------------------

async function hmacBase64Url(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return toBase64Url(new Uint8Array(signature));
}

/**
 * Length-safe constant-time comparison.
 *
 * Same guarantee as `timingSafeEqual`: the loop runs over the whole buffer
 * regardless of where a difference appears. The length check up front leaks only
 * the length, which is fixed at 32 bytes for a SHA-256 MAC.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  // Index-based loop: `entries()` yields `[index, value-of-a]` pairs, so
  // destructuring it would compare the index against the value and never read
  // `b` at all. Indices are safe under `noUncheckedIndexedAccess` because the
  // loop is bounded by the length check above.
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number);
  }
  return diff === 0;
}

export async function createSignedState(): Promise<string> {
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const mac = await hmacBase64Url(getStateSecret(), nonce);
  return `${nonce}.${mac}`;
}

export async function verifySignedState(state: string): Promise<boolean> {
  const parts = state.split(".");
  if (parts.length !== 2) return false;
  const [nonce, mac] = parts as [string, string];
  // A malformed MAC must not throw: an attacker controls this string, and the
  // only acceptable answer to garbage is "rejected".
  const presented = fromBase64Url(mac);
  if (!presented || toBase64Url(presented) !== mac) return false;
  const expected = fromBase64Url(await hmacBase64Url(getStateSecret(), nonce));
  if (!expected) return false;
  return constantTimeEqual(presented, expected);
}

// --- Authorization URL -----------------------------------------------------

export function buildGoogleAuthorizeUrl(
  redirectUri: string,
  state: string,
): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  // Only the scopes actually needed to identify the user.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

// --- Code exchange + verification -----------------------------------------

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
};

async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed with status ${res.status}.`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Verifies the token with Google directly and returns the trusted claims.
 * The request is server-to-server over TLS to a Google-owned endpoint, so the
 * claims cannot be forged by the browser.
 */
async function verifyWithGoogle(
  token: string,
  kind: "access_token" | "id_token",
): Promise<GoogleClaims> {
  const url = `${GOOGLE_TOKENINFO_ENDPOINT}?${kind}=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Google token verification failed with status ${res.status}.`,
    );
  }
  const claims = (await res.json()) as GoogleClaims & {
    error?: string;
    expires_in?: string;
  };
  if (claims.error) {
    throw new Error("Google rejected the token.");
  }
  if (claims.aud !== getGoogleClientId()) {
    throw new Error("Token audience does not match this application.");
  }
  if (
    claims.iss !== "https://accounts.google.com" &&
    claims.iss !== "accounts.google.com"
  ) {
    throw new Error("Unexpected token issuer.");
  }
  if (!claims.sub) {
    throw new Error("Token is missing a subject identifier.");
  }
  if (claims.email_verified !== true && claims.email_verified !== "true") {
    throw new Error("Google reports the address as unverified.");
  }
  return { ...claims, email_verified: true };
}

export type VerifiedGoogleSession = {
  providerAccountId: string;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

export async function completeGoogleLogin(
  code: string,
  redirectUri: string,
): Promise<VerifiedGoogleSession> {
  const tokens = await exchangeCode(code, redirectUri);

  // Prefer the id_token when present; otherwise validate the access token.
  const claims = tokens.id_token
    ? await verifyWithGoogle(tokens.id_token, "id_token")
    : tokens.access_token
      ? await verifyWithGoogle(tokens.access_token, "access_token")
      : (() => {
          throw new Error("Google returned no verifiable token.");
        })();

  return {
    providerAccountId: claims.sub,
    email: claims.email.toLowerCase(),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt:
      typeof tokens.expires_in === "number"
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
  };
}
