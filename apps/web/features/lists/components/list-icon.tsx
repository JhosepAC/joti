import type { ReactNode } from "react";
export const LIST_ICONS = [
  "table",
  "check",
  "basket",
  "plane",
  "book",
  "briefcase",
  "heart",
  "bolt",
  "pin",
  "tag",
];
export function ListGlyph({
  name,
}: {
  name:
    | "close"
    | "more"
    | "plus"
    | "grip"
    | "up"
    | "down"
    | "right"
    | "open"
    | "undo"
    | "tick"
    | "star"
    | "copy"
    | "edit"
    | "calendar"
    | "mail"
    | "phone";
}) {
  const paths: Record<string, ReactNode> = {
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    edit: <path d="m4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 2v6m10-6v6M3 11h18" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </>
    ),
    phone: (
      <path d="m5 3 4 1 1 5-3 2a16 16 0 0 0 6 6l2-3 5 1 1 4c-2 6-10 1-14-3S0 5 5 3Z" />
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    grip: (
      <>
        <path
          d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01"
          strokeWidth="3"
        />
      </>
    ),
    up: <path d="m6 14 6-6 6 6" />,
    down: <path d="m6 10 6 6 6-6" />,
    right: <path d="m10 6 6 6-6 6" />,
    open: <path d="M7 17 17 7M7 7h10v10" />,
    undo: <path d="m8 4-5 5 5 5M3 9h10a7 7 0 1 1 0 14" />,
    tick: <path d="m5 12 5 5 9-10" />,
  };
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function ListIcon({ name = "table" }: { name?: string }) {
  const paths: Record<string, ReactNode> = {
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 9v11m-6-6h18" />
      </>
    ),
    check: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    basket: (
      <>
        <path d="m3 9 2 11h14l2-11H3Zm4 0 5-6 5 6M9 13v4m6-4v4" />
      </>
    ),
    plane: (
      <path d="m3 10 7 1V4l2-2 2 2v7l7-1v3l-7 3v4l3 1v1H7v-1l3-1v-4l-7-3v-3Z" />
    ),
    book: (
      <>
        <path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2V4Z" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V3h8v4M3 12h18m-9-1v3" />
      </>
    ),
    heart: (
      <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8 6l8 8 8-8a5 5 0 0 0 0-7Z" />
    ),
    bolt: <path d="m13 2-9 12h7l-1 8L20 9h-8l1-7Z" />,
    pin: (
      <>
        <path d="m14 3 7 7-5 1-3 5-5-5 5-3 1-5ZM10 14l-6 6" />
      </>
    ),
    tag: (
      <>
        <path d="m3 3 9 1 9 9-8 8-9-9-1-9Z" />
        <circle cx="8" cy="8" r="1" />
      </>
    ),
  };
  if (!paths[name])
    return (
      <span className="lists-custom-icon" aria-hidden="true">
        {name}
      </span>
    );
  return (
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
      {paths[name]}
    </svg>
  );
}
export function PropertyIcon({ type }: { type: string }) {
  return (
    <span className="lists-property-icon" aria-hidden="true">
      {type === "checkbox" ? (
        <ListIcon name="check" />
      ) : type === "date" ? (
        <svg
          viewBox="0 0 24 24"
          width="1em"
          height="1em"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 2v6m10-6v6M3 11h18" />
        </svg>
      ) : ["number", "currency", "percent", "rating"].includes(type) ? (
        type === "rating" ? (
          <ListGlyph name="star" />
        ) : type === "currency" ? (
          "$"
        ) : type === "percent" ? (
          "%"
        ) : (
          "#"
        )
      ) : type === "select" || type === "status" || type === "multiSelect" ? (
        <svg
          viewBox="0 0 24 24"
          width="1em"
          height="1em"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8 10 4 4 4-4" />
        </svg>
      ) : type === "email" || type === "phone" ? (
        <ListGlyph name={type === "email" ? "mail" : "phone"} />
      ) : type === "url" ? (
        <ListGlyph name="open" />
      ) : (
        "Aa"
      )}
    </span>
  );
}
