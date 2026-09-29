/**
 * Client-side shape of the spaces feature.
 *
 * The purpose keys and the icon set are duplicated from
 * `convex/spaces/constants.ts`: `convex/` is the server module and the app does
 * not import from it. Drift here is possible at compile time, so the real
 * enforcement is server-side and unchanged either way — `validateSpaceIcon` /
 * `validateSpacePurpose` reject an unknown value, and the unions in `schema.ts`
 * make it unstorable. A client that drifted would show an icon the server then
 * refuses, not a space it should not have got.
 */

export const SPACE_PURPOSE_KEYS = ["personal", "work", "study", "blank"] as const;

export type SpacePurposeKey = (typeof SPACE_PURPOSE_KEYS)[number];

export const SPACE_ICON_CHOICES = [
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

export type SpaceIconChoice = (typeof SPACE_ICON_CHOICES)[number];

export const SPACE_ICON_DEFAULT: SpaceIconChoice = "🚀";

/** Steps of the first-space flow, as shown in "Paso n de N". */
export const FIRST_SPACE_TOTAL_STEPS = 3;

export type FirstSpaceStep = 1 | 2 | 3;

export interface SpaceDraft {
  name: string;
  icon: SpaceIconChoice;
  purpose: SpacePurposeKey;
}

export interface SpaceTool {
  key: string;
  label: string;
}

export interface WorkspaceSpace {
  slug: string;
  name: string;
  icon: string;
  purpose: SpacePurposeKey;
  is_private: boolean;
  created_at: number;
}
