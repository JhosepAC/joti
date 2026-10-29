import { type SpacePurposeKey } from "./types/space.types";
import { sanitizeSpaceNameInput } from "./validations/space.schema";

/**
 * Choice keys for the first-space flow.
 *
 * Display copy lives in the `spaces.purpose.options` i18n namespace, not here:
 * titles and descriptions are presentation, while this module owns only which
 * choices exist and the default-name rule below.
 *
 * Per the design rules, no emoji appear in copy: icons are inline SVG and
 * the only emoji in the product is the space's own icon.
 */
export const PURPOSE_KEYS = [
  "personal",
  "work",
  "study",
  "blank",
] as const satisfies ReadonlyArray<SpacePurposeKey>;

/**
 * Default name offered in step 1, per the flow spec.
 *
 * Sanitized and clamped rather than trusted: the display name comes from the
 * profile, and a prefill that the field's own validator would reject would leave
 * the user staring at a disabled "Siguiente" before typing anything.
 */
export function defaultSpaceName(
  displayName: string | null,
  maxLength: number,
  locale = "es",
): string {
  const trimmed = sanitizeSpaceNameInput((displayName ?? "").trim());
  const base =
    locale === "en"
      ? trimmed.length > 0
        ? `Space for ${trimmed}`
        : "My space"
      : trimmed.length > 0
        ? `Espacio de ${trimmed}`
        : "Mi espacio";
  return sanitizeSpaceNameInput(
    base.length > maxLength ? base.slice(0, maxLength).trim() : base,
  );
}
