import type { ReactNode } from "react";
export function AccountGlyph({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    security: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    preferences: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    danger: (
      <>
        <path d="M10 4 2 19h20L14 4a2.3 2.3 0 0 0-4 0Z" />
        <path d="M12 9v4m0 3v1" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    settings: (
      <>
        <path d="m9 3-.5 3-2.5 1-2.5-1-2 3.5L4 12l-2.5 2.5 2 3.5L6 17l2.5 1L9 21h6l.5-3 2.5-1 2.5 1 2-3.5L20 12l2.5-2.5-2-3.5L18 7l-2.5-1L15 3H9Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h11" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.profile}
    </svg>
  );
}
