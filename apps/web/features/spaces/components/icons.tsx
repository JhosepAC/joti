"use client";

import * as React from "react";
import type { SpacePurposeKey } from "../types/space.types";

/** Inline SVG icons that inherit the surrounding text color. */

type IconProps = React.SVGProps<SVGSVGElement>;

function Svg({
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export const LockIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4" y="10" width="16" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const HomeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const BriefcaseIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    <path d="M3 12.5h18" />
  </Svg>
);

export const GraduationIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 4 22 9l-10 5L2 9l10-5Z" />
    <path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
    <path d="M22 9v5" />
  </Svg>
);

export const BlankIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 4.5h9.5L19 9v10.5H5z" />
    <path d="M14 4.5V9h5" />
  </Svg>
);

export const RocketIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3c3 2 4.5 5 4.5 8.5L12 16l-4.5-4.5C7.5 8 9 5 12 3Z" />
    <path d="M9.5 13.5 7 16l1 3 2.5-1" />
    <path d="M14.5 13.5 17 16l-1 3-2.5-1" />
    <circle cx="12" cy="9" r="1.4" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </Svg>
);

export const PencilIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
    <path d="m14 6 4 4" />
  </Svg>
);

export const MoreHorizontalIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Svg>
);

export const FilterIcon = (props: IconProps) => (
  <Svg {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const LayersIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);

export const LogoutIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);

export const GlobeIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 3.9 5.7 3.9 9S14.5 18.4 12 21c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" />
  </Svg>
);

export const SpinnerIcon = (props: IconProps) => (
  <Svg {...props} className={`animate-spin ${props.className ?? ""}`}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Svg>
);

/** Presentation only; the exhaustive switch means a new purpose fails to compile. */
export function iconForPurpose(purpose: SpacePurposeKey): React.FC<IconProps> {
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
