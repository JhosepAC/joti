import { type SpacePurpose } from "./constants";

// ---------------------------------------------------------------------------
// Purpose → template.
//
// A space's `purpose` is the only thing stored about its setup; the template it
// selects and the tools it enables are derived from it here. Deriving instead of
// copying means the mapping can gain a tool later without rewriting existing
// rows, and it makes it impossible for a caller to grant themselves a tool the
// product would not have enabled for that purpose.
//
// The tool *labels* live here too, so the summary step shows exactly what the
// server will apply instead of the client guessing.
// ---------------------------------------------------------------------------

export const SPACE_TOOL_KEYS = [
  "notes",
  "tasks",
  "journal",
  "projects",
  "meetings",
  "assignments",
  "calendar",
] as const;

export type SpaceToolKey = (typeof SPACE_TOOL_KEYS)[number];

export interface SpaceTool {
  key: SpaceToolKey;
  label: string;
}

export interface SpaceTemplate {
  /** Identifier of the template that will seed the space's content. */
  templateKey: string;
  tools: readonly SpaceTool[];
}

export const PURPOSE_TEMPLATES: Record<SpacePurpose, SpaceTemplate> = {
  personal: {
    templateKey: "personal_v1",
    tools: [
      { key: "notes", label: "Notas" },
      { key: "tasks", label: "Tareas" },
      { key: "journal", label: "Diario" },
    ],
  },
  work: {
    templateKey: "work_v1",
    tools: [
      { key: "tasks", label: "Tareas" },
      { key: "projects", label: "Proyectos" },
      { key: "meetings", label: "Actas de reunión" },
    ],
  },
  study: {
    templateKey: "study_v1",
    tools: [
      { key: "notes", label: "Apuntes" },
      { key: "assignments", label: "Entregables" },
      { key: "calendar", label: "Fechas de exámenes" },
    ],
  },
  blank: {
    templateKey: "blank_v1",
    // "En blanco" means no template and no sample data, not "no functionality":
    // a space with nothing to write in would be useless.
    tools: [{ key: "notes", label: "Notas" }],
  },
};

export function resolveTemplate(purpose: SpacePurpose): SpaceTemplate {
  return PURPOSE_TEMPLATES[purpose];
}
