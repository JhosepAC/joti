"use client";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useState } from "react";
import { SpaceSymbol } from "./space-symbol";
export function RailSpaceLink({
  space,
  active,
}: {
  space: { slug: string; name: string; icon: string };
  active: boolean;
}) {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPosition({ left: Math.max(8, r.left), top: r.top - 8 });
  };
  return (
    <>
      <Link
        href={`/w/${space.slug}`}
        aria-label={space.name}
        aria-current={active ? "page" : undefined}
        onPointerEnter={(e) => show(e.currentTarget)}
        onPointerLeave={() => setPosition(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setPosition(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPosition(null);
        }}
      >
        <SpaceSymbol value={space.icon} />
      </Link>
      {position &&
        createPortal(
          <div
            className="workspace-space-tooltip"
            role="tooltip"
            style={{ left: position.left, top: position.top }}
          >
            {space.name}
          </div>,
          document.body,
        )}
    </>
  );
}
