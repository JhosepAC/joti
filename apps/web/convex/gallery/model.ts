import { v, ConvexError } from "convex/values";
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const MAX_IMAGES = 5000;
export const MAX_SPACE_BYTES = 512 * 1024 * 1024;
export const imageVariants = {
  original: v.optional(v.id("_storage")),
  high: v.optional(v.id("_storage")),
  medium: v.optional(v.id("_storage")),
  thumb: v.optional(v.id("_storage")),
  placeholder: v.optional(v.id("_storage")),
};
export const preferenceFields = {
  view: v.string(),
  size: v.string(),
  density: v.string(),
  sort: v.string(),
  direction: v.string(),
  info: v.boolean(),
  group: v.string(),
};
export const DEFAULT_PREFERENCES = {
  view: "grid",
  size: "medium",
  density: "comfortable",
  sort: "uploaded",
  direction: "desc",
  info: true,
  group: "month",
};
export type GalleryPreferences = typeof DEFAULT_PREFERENCES;
export function fail(code: string): never {
  throw new ConvexError({ code });
}
export function cleanTags(tags: string[]) {
  if (tags.length > 12 || tags.some((t) => !t.trim() || t.length > 30))
    fail("VALIDATION_ERROR");
  return [...new Set(tags.map((t) => t.trim().toLocaleLowerCase()))];
}
export function validPreferences(p: GalleryPreferences) {
  if (
    !["grid", "masonry", "compact", "list", "timeline"].includes(p.view) ||
    !["small", "medium", "large"].includes(p.size) ||
    !["comfortable", "compact"].includes(p.density) ||
    !["uploaded", "captured", "name", "manual"].includes(p.sort) ||
    !["asc", "desc"].includes(p.direction) ||
    !["day", "month", "year"].includes(p.group)
  )
    fail("VALIDATION_ERROR");
  return p;
}
