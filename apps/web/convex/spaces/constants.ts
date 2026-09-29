/**
 * Spaces feature — single source of truth for everything the database has to
 * guarantee.
 *
 * The onboarding UI keeps its own labels and descriptions (presentation), but
 * the allowed icon set, the purpose enumeration and the length limits live
 * here only. `schema.ts` and `validators.ts` both derive from these tuples, so
 * an invalid value cannot reach a row.
 */

// --- Name ---

export const SPACE_NAME_MIN_LENGTH = 3;
export const SPACE_NAME_MAX_LENGTH = 50;

/**
 * Unicode control characters, plus the zero-width and bidi-override ranges.
 * Rejecting the latter matters because they are invisible: "mi espacio" and
 * "mi esp‌acio" render identically but would be two different rows.
 */
export const SPACE_NAME_CONTROL_CHARS_REGEX =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;

// --- Icon ---

/** Emoji offered by the picker. This is also the only emoji the product uses. */
export const ALLOWED_SPACE_ICONS = [
  "🚀",
  "🏠",
  "💼",
  "🎓",
  "🧠",
  "⚡",
  "📌",
  "🎨",
  "🩷",
] as const;

export type SpaceIcon = (typeof ALLOWED_SPACE_ICONS)[number];

export const DEFAULT_SPACE_ICON: SpaceIcon = "🚀";

/** Lookup set for `validateSpaceIcon`. */
export const SPACE_ICON_SET: ReadonlySet<string> = new Set<string>(ALLOWED_SPACE_ICONS);

// --- Purpose ---

export const SPACE_PURPOSES = ["personal", "work", "study", "blank"] as const;

export type SpacePurpose = (typeof SPACE_PURPOSES)[number];

export const DEFAULT_SPACE_PURPOSE: SpacePurpose = "personal";

export const SPACE_PURPOSE_SET: ReadonlySet<string> = new Set<string>(SPACE_PURPOSES);

// --- Slug ---

/** Longest slug segment generated from a name. Keeps `/w/<slug>` readable. */
export const SPACE_SLUG_MAX_LENGTH = 40;

/** Fallback when a name has no URL-safe characters left (e.g. "???"). */
export const SPACE_SLUG_FALLBACK = "espacio";

/** `slug`, `slug-2`, `slug-3`, … attempts before giving up on a name. */
export const SPACE_SLUG_MAX_ATTEMPTS = 50;

/** Slugs are lowercase, digits and single dashes. Anything else is rejected. */
export const SPACE_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
