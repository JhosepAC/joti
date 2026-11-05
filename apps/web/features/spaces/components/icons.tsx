"use client";

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Ellipsis,
  FileText,
  Filter,
  Globe,
  GraduationCap,
  House,
  Layers,
  LoaderCircle,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Rocket,
  Search,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { SpacePurposeKey } from "../types/space.types";

function spaceIcon(Icon: LucideIcon) {
  return function SpaceGlyph(props: LucideProps) {
    return <Icon size="1em" strokeWidth={1.7} aria-hidden="true" {...props} />;
  };
}

export const LockIcon = spaceIcon(Lock);
export const HomeIcon = spaceIcon(House);
export const BriefcaseIcon = spaceIcon(Briefcase);
export const GraduationIcon = spaceIcon(GraduationCap);
export const BlankIcon = spaceIcon(FileText);
export const RocketIcon = spaceIcon(Rocket);
export const CheckIcon = spaceIcon(Check);
export const ArrowLeftIcon = spaceIcon(ArrowLeft);
export const ArrowRightIcon = spaceIcon(ArrowRight);
export const PencilIcon = spaceIcon(Pencil);
export const MoreHorizontalIcon = spaceIcon(Ellipsis);
export const FilterIcon = spaceIcon(Filter);
export const SearchIcon = spaceIcon(Search);
export const PlusIcon = spaceIcon(Plus);
export const LayersIcon = spaceIcon(Layers);
export const LogoutIcon = spaceIcon(LogOut);
export const GlobeIcon = spaceIcon(Globe);

export function SpinnerIcon({ className, ...props }: LucideProps) {
  return (
    <LoaderCircle
      size="1em"
      strokeWidth={1.7}
      aria-hidden="true"
      className={`animate-spin ${className ?? ""}`}
      {...props}
    />
  );
}

/** Presentation only; the exhaustive switch means a new purpose fails to compile. */
export function iconForPurpose(
  purpose: SpacePurposeKey,
): ReturnType<typeof spaceIcon> {
  switch (purpose) {
    case "work":
      return BriefcaseIcon;
    case "study":
      return GraduationIcon;
    case "blank":
      return BlankIcon;
    case "personal":
      return HomeIcon;
  }
}
