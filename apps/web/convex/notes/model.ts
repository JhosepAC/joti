import { v } from "convex/values";
export const metadataFields = {
  title: v.string(),
  icon: v.string(),
  color: v.string(),
  tags: v.array(v.string()),
};
export const contentFields = { ...metadataFields, body: v.string() };
export const noteFields = {
  ...contentFields,
  pinned: v.boolean(),
  archived: v.boolean(),
  trashed: v.boolean(),
};
export interface NoteContent {
  title: string;
  body: string;
  icon: string;
  color: string;
  tags: string[];
}
export interface Note extends NoteContent {
  key: string;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
  pageId?: string;
}
export interface NoteSummary extends Omit<Note, "body"> {
  preview: string;
}
export const NOTE_COLORS = ["plain", "sand", "blue", "green", "rose"];
export function validateNote<T extends NoteContent>(note: T): T {
  if (
    !note.title.trim() ||
    note.title.length > 120 ||
    note.body.length > 30000 ||
    !NOTE_COLORS.includes(note.color) ||
    ![
      "book",
      "bolt",
      "heart",
      "briefcase",
      "pin",
      "tag",
      "check",
      "plane",
      "basket",
      "table",
    ].includes(note.icon) ||
    note.tags.length > 12 ||
    note.tags.some((t) => !t.trim() || t.length > 30) ||
    new Set(note.tags.map((t) => t.trim().toLowerCase())).size !==
      note.tags.length ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(
      note.title + note.body + note.tags.join(""),
    )
  )
    throw Error("VALIDATION_ERROR");
  return {
    ...note,
    title: note.title.trim(),
    tags: note.tags.map((t) => t.trim()),
  };
}
export function notePreview(body: string) {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~|]/g, "")
    .trim()
    .slice(0, 240);
}
