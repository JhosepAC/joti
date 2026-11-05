"use client";
import { LIST_ICONS, ListIcon } from "@/features/lists/components/list-icon";
import type { ReactNode } from "react";
import { SPACE_ICON_CHOICES } from "../types/space.types";
import { spaceTileStyle } from "../utils/space-colors";
import type { DashboardSpace } from "../types/dashboard.types";
import {
  BlankIcon,
  BriefcaseIcon,
  GraduationIcon,
  HomeIcon,
  RocketIcon,
} from "./icons";

// Existing stored identifiers stay compatible; the UI uses one vector language.
const [ROCKET, HOME, WORK, STUDY, IDEA, ENERGY, PIN, ART, HEART] =
  SPACE_ICON_CHOICES;
export const workspaceIconChoices = [
  { value: ROCKET, key: "rocket" },
  { value: HOME, key: "home" },
  { value: WORK, key: "briefcase" },
  { value: STUDY, key: "study" },
  { value: IDEA, key: "idea" },
  { value: ENERGY, key: "bolt" },
  { value: PIN, key: "pin" },
  { value: ART, key: "art" },
  { value: HEART, key: "heart" },
  ...["table", "check", "basket", "plane", "book", "tag"].map((key) => ({
    value: `symbol:${key}`,
    key,
  })),
];

const equivalentIcons: Record<string, string> = {
  "symbol:briefcase": WORK,
  "symbol:bolt": ENERGY,
  "symbol:pin": PIN,
  "symbol:heart": HEART,
};

export function normalizeWorkspaceIcon(value: string): string {
  return equivalentIcons[value] ?? value;
}

export function SpaceSymbol({ value }: { value: string }) {
  value = normalizeWorkspaceIcon(value);
  if (value.startsWith("symbol:")) {
    const name = value.slice(7);
    return LIST_ICONS.includes(name) ? <ListIcon name={name} /> : <BlankIcon />;
  }
  if (value.startsWith("media:")) {
    const [, slug, key] =
      value.split(":"); /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        className="workspace-space-image"
        src={
          "/api/gallery/media?slug=" +
          encodeURIComponent(slug ?? "") +
          "&key=" +
          encodeURIComponent(key ?? "") +
          "&variant=thumb"
        }
        alt=""
      />
    );
  }
  if (value === ROCKET) return <RocketIcon />;
  if (value === HOME) return <HomeIcon />;
  if (value === WORK) return <BriefcaseIcon />;
  if (value === STUDY) return <GraduationIcon />;
  const paths: Record<string, ReactNode> = {
    [IDEA]: (
      <>
        <path d="M12 5a3 3 0 0 0-5-2 4 4 0 0 0-3 6 4 4 0 0 0 0 7 4 4 0 0 0 6 4l2-2V5Zm0 0a3 3 0 0 1 5-2 4 4 0 0 1 3 6 4 4 0 0 1 0 7 4 4 0 0 1-6 4l-2-2" />
        <path d="M7 8c3 0 3 3 3 3m7-3c-3 0-3 3-3 3M7 16l3-2m7 2-3-2" />
      </>
    ),
    [ENERGY]: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" />,
    [PIN]: (
      <>
        <path d="m15 3 6 6-4 1-3 5-2-2-6 6m1-12 2-4 6 6-4 2-4-4Z" />
      </>
    ),
    [ART]: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a5 5 0 0 0 5-5c0-3-5-5-9-5Z" />
        <circle cx="7" cy="10" r=".6" />
        <circle cx="10" cy="6.5" r=".6" />
        <circle cx="15" cy="7" r=".6" />
      </>
    ),
    [HEART]: (
      <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8 6l8 8 8-8a5 5 0 0 0 0-7Z" />
    ),
  };
  return paths[value] ? (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[value]}
    </svg>
  ) : (
    <BlankIcon />
  );
}

export function WorkspaceSpaceBadge({
  space,
}: {
  space: Pick<DashboardSpace, "icon" | "background" | "iconColor">;
}) {
  return (
    <span
      className="workspace-space-badge"
      style={spaceTileStyle(space.background, space.iconColor)}
      aria-hidden="true"
    >
      <SpaceSymbol value={space.icon} />
    </span>
  );
}
