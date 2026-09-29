import { type SpacePurposeKey } from "./types/space.types";
import { sanitizeSpaceNameInput } from "./validations/space.schema";

/**
 * Copy for the first-space flow.
 *
 * Only the *choice* copy lives here. The consequences of a choice (which
 * template is applied, which tools are enabled) are derived on the server and
 * fetched for the summary step, so the preview cannot drift from what will
 * actually be created.
 *
 * Per the design rules, no emoji appear in this copy: icons are inline SVG and
 * the only emoji in the product is the space's own icon.
 */
export interface PurposeOption {
  key: SpacePurposeKey;
  title: string;
  description: string;
}

export const PURPOSE_OPTIONS: readonly PurposeOption[] = [
  {
    key: "personal",
    title: "Personal",
    description:
      "Diseñado para proyectos propios, notas rápidas y organización diaria.",
  },
  {
    key: "work",
    title: "Trabajo / Negocios",
    description:
      "Diseñado para gestión de tareas, actas de reuniones y proyectos.",
  },
  {
    key: "study",
    title: "Estudios / Universidad",
    description:
      "Diseñado para apuntes de clases, entregables y fechas de exámenes.",
  },
  {
    key: "blank",
    title: "En blanco / Minimalista",
    description: "Espacio totalmente limpio sin plantillas ni datos de ejemplo.",
  },
];

export function purposeTitle(key: SpacePurposeKey): string {
  return PURPOSE_OPTIONS.find((option) => option.key === key)?.title ?? "";
}

/**
 * Default name offered in step 1, per the flow spec.
 *
 * Sanitized and clamped rather than trusted: the display name comes from the
 * profile, and a prefill that the field's own validator would reject would leave
 * the user staring at a disabled "Siguiente" before typing anything.
 */
export function defaultSpaceName(displayName: string | null, maxLength: number): string {
  const trimmed = sanitizeSpaceNameInput((displayName ?? "").trim());
  const base = trimmed.length > 0 ? `Espacio de ${trimmed}` : "Mi Espacio";
  return sanitizeSpaceNameInput(base.length > maxLength ? base.slice(0, maxLength).trim() : base);
}
