/**
 * Shared auth constants - single source of truth for validation and security policy.
 */

// --- Username ---
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-z0-9_]+$/;

// Reserved usernames that collide with routes or privileged roles
export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "api",
  "auth",
  "login",
  "register",
  "signin",
  "signup",
  "signout",
  "settings",
  "dashboard",
  "joti",
  "help",
  "support",
  "terms",
  "privacy",
  "workspace",
  "workspaces",
  "null",
  "undefined",
  "system",
  "profile",
  "user",
  "users",
  "oauth",
  "callback",
]);

// --- Email ---
export const EMAIL_MAX_LENGTH = 320;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Password ---
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// --- Display name / Bio ---
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const BIO_MAX_LENGTH = 500;
export const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

// --- Avatar ---
export const AVATAR_MAX_LENGTH = 2048;

/** Upload URLs a single account may mint per hour. */
export const AVATAR_UPLOADS_PER_HOUR = 10;

/** Global ceiling on stored objects, as a backstop against distributed abuse. */
export const MAX_STORAGE_OBJECTS = 2_000;

// --- Security ---
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// --- Password reset ---
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000; // 1 minute between requests (per email)
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour link expiry
export const PASSWORD_RESET_MAX_PER_HOUR = 5; // max 5 links per hour per email

// --- Email verification ---
export const VERIFICATION_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const VERIFICATION_CODE_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
export const VERIFICATION_MAX_ATTEMPTS = 5; // wrong-code attempts per issued code

/** Cap on verification emails per hour per address, across all entry points. */
export const VERIFICATION_MAX_PER_HOUR = 5;

/** How long a fresh email verification stays valid for completing signup. */
export const VERIFICATION_RECENT_MS = 30 * 60 * 1000; // 30 minutes

// --- Claim grants ---
/**
 * Lifetime of the short-lived proof-of-address token issued after a successful
 * login or code redemption. Must cover both remaining wizard steps (avatar
 * upload, then profile submit) without being long enough to be a bearer token
 * in practice.
 */
export const CLAIM_GRANT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Scopes. A grant authorises exactly one kind of step, so a token minted to
 * finish onboarding cannot be replayed against a space (or the other way round).
 *
 * - `account`: "you just proved you own this address". Used by the profile gate
 *   and by the first-space step.
 * - `space`: "you may act on this one space", additionally bound to a
 *   `space_id`. Used by `/w/<slug>`.
 */
export const CLAIM_SCOPE_ACCOUNT = "account";
export const CLAIM_SCOPE_SPACE = "space";

export const CLAIM_SCOPES = [CLAIM_SCOPE_ACCOUNT, CLAIM_SCOPE_SPACE] as const;

export type ClaimScope = (typeof CLAIM_SCOPES)[number];

// --- Login ---
/** Failed logins allowed per email per window, before lockout kicks in. */
export const LOGIN_MAX_ATTEMPTS_PER_HOUR = 20;

// --- Password hashing ---
// bcrypt cost factor (OWASP recommends >=10, 12 is balanced)
export const BCRYPT_COST = 12;

// Argon2id params kept for reference / future migration to @noble/hashes/argon2
export const ARGON2_MEMORY_COST = 19_456; // 19 MiB
export const ARGON2_TIME_COST = 2;
export const ARGON2_OUTPUT_LEN = 32;
export const ARGON2_PARALLELISM = 1;
