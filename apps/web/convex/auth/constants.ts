/**
 * Shared auth constants — single source of truth for validation and security policy.
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

// --- Security ---
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// --- Password reset ---
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000; // 1 minute between requests (per email)
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour link expiry
export const PASSWORD_RESET_MAX_PER_HOUR = 5; // max 5 links per hour per email

// Password hashing — bcrypt cost factor (OWASP recommends >=10, 12 is balanced)
export const BCRYPT_COST = 12;

// Argon2id params kept for reference / future migration to @noble/hashes/argon2
export const ARGON2_MEMORY_COST = 19_456; // 19 MiB
export const ARGON2_TIME_COST = 2;
export const ARGON2_OUTPUT_LEN = 32;
export const ARGON2_PARALLELISM = 1;
