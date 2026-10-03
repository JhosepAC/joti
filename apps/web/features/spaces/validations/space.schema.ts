/**
 * Client-side validation for the first-space flow.
 *
 * Mirrors `convex/spaces/validators.ts` so the form can reject bad input
 * immediately. The server validates again on every write — these checks are for
 * feedback, never for trust.
 */

export const SPACE_NAME_MIN_LENGTH = 3;
export const SPACE_NAME_MAX_LENGTH = 50;

/**
 * Same ranges as the server: C0/C1 controls, zero-width and bidi overrides.
 *
 * Written through `RegExp` rather than as a literal, and in two variants on
 * purpose: a `g` regex is stateful under `.test()` (it advances `lastIndex`
 * between calls, so the same value would alternate between valid and invalid),
 * while `String.replace` needs the `g` flag to strip more than one occurrence.
 * One shared global regex would therefore be wrong in both directions.
 */
const CONTROL_CHARS = "[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]";

/** Non-global: safe to reuse across `.test()` calls. */
const CONTROL_CHARS_REGEX = new RegExp(CONTROL_CHARS);

/** Global: strips every occurrence, not just the first. */
const CONTROL_CHARS_GLOBAL_REGEX = new RegExp(CONTROL_CHARS, "g");

export function validateSpaceNameInput(
  name: string,
  t: (key: "required" | "minLength" | "maxLength" | "invalidChars", vars?: Record<string, number>) => string,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return t("required");
  if (trimmed.length < SPACE_NAME_MIN_LENGTH) {
    return t("minLength", { min: SPACE_NAME_MIN_LENGTH });
  }
  if (trimmed.length > SPACE_NAME_MAX_LENGTH) {
    return t("maxLength", { max: SPACE_NAME_MAX_LENGTH });
  }
  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    return t("invalidChars");
  }
  return null;
}

/** Strips control characters as the user types, so that error is unreachable. */
export function sanitizeSpaceNameInput(name: string): string {
  return name.replace(CONTROL_CHARS_GLOBAL_REGEX, "");
}
