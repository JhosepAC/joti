"use client";
import {
  Brain,
  FileText,
  Heart,
  Palette,
  Pin,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LIST_ICONS, ListIcon } from "@/features/lists/components/list-icon";
import { SPACE_ICON_CHOICES } from "../types/space.types";
import { spaceTileStyle } from "../utils/space-colors";
import type { DashboardSpace } from "../types/dashboard.types";
import { BriefcaseIcon, GraduationIcon, HomeIcon, RocketIcon } from "./icons";

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
  return Object.hasOwn(equivalentIcons, value)
    ? equivalentIcons[value]!
    : value;
}

const legacyIcons = new Map<string, LucideIcon>([
  [IDEA, Brain],
  [ENERGY, Zap],
  [PIN, Pin],
  [ART, Palette],
  [HEART, Heart],
]);

export function SpaceSymbol({ value }: { value: string }) {
  value = normalizeWorkspaceIcon(value);
  if (value.startsWith("symbol:")) {
    const name = value.slice(7);
    return LIST_ICONS.includes(name) ? (
      <ListIcon name={name} />
    ) : (
      <FileText size="1em" strokeWidth={1.7} aria-hidden="true" />
    );
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
  const Icon = legacyIcons.get(value) ?? FileText;
  return <Icon size="1em" strokeWidth={1.7} aria-hidden="true" />;
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
