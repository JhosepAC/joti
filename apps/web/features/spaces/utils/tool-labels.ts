"use client";

import { useTranslations } from "next-intl";

/**
 * Server tool labels stay as fallback for tool keys this client does not
 * know, so a future server-side tool never renders blank in an older client.
 */
export const KNOWN_TOOL_KEYS = [
  "notes",
  "tasks",
  "journal",
  "projects",
  "meetings",
  "assignments",
  "calendar",
] as const;

export type KnownToolKey = (typeof KNOWN_TOOL_KEYS)[number];

export function isKnownToolKey(key: string): key is KnownToolKey {
  return (KNOWN_TOOL_KEYS as readonly string[]).includes(key);
}

export function useToolLabel() {
  const tTools = useTranslations("spaces.tools");
  return (key: string, fallback: string) =>
    isKnownToolKey(key) ? tTools(key) : fallback;
}
