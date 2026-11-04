"use client";
import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect } from "react";
import { Popover } from "@/features/lists/components/overlays";
import { ListGlyph } from "@/features/lists/components/list-icon";
import { useLocale, useTranslations } from "next-intl";
import type { DashboardSpace } from "../types/dashboard.types";
import { SpaceSymbol } from "./space-symbol";
export function RailSpaceLink({
  space,
  active,
  onAction,
  onMove,
}: {
  space: DashboardSpace;
  onAction: (action: "favorite" | "name" | "icon" | "all") => void;
  onMove: (direction: number) => void;
  active: boolean;
}) {
  const t = useTranslations("spaceRail"),
    locale = useLocale();
  const [menu, setMenu] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPosition({ left: Math.max(8, r.left), top: r.top - 8 });
  };
  const tileStyle = {
    background: space.background || undefined,
    color:
      space.background &&
      parseInt(space.background.slice(1, 3), 16) * 0.299 +
        parseInt(space.background.slice(3, 5), 16) * 0.587 +
        parseInt(space.background.slice(5, 7), 16) * 0.114 <
        140
        ? "#ffffff"
        : undefined,
  };
  return (
    <div
      className="rail-space-item"
      data-selected={active || undefined}
      data-menu-open={menu || undefined}
    >
      <Link
        ref={anchor}
        aria-haspopup="dialog"
        aria-expanded={menu}
        href={`/w/${space.slug}`}
        style={tileStyle}
        draggable={false}
        onContextMenu={(event) => {
          event.preventDefault();
          setPosition(null);
          setMenu(true);
        }}
        onKeyDownCapture={(event) => {
          if (
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
            setMenu(true);
          }
          if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            onMove(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
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
        <LinkProgress label={t("loading")} />
      </Link>
      {active && (
        <span className="rail-selection-mark" aria-hidden="true" />
      )}
      {space.favorite && (
        <span className="rail-favorite" aria-hidden="true">
          <ListGlyph name="star" />
        </span>
      )}
      {menu && (
        <Popover
          anchor={anchor}
          label={space.name}
          onClose={() => {
            setMenu(false);
            anchor.current?.focus();
          }}
        >
          <div className="rail-space-menu">
            <header className="rail-menu-identity">
              <span style={tileStyle}>
                <SpaceSymbol value={space.icon} />
              </span>
              <strong>{space.name}</strong>
            </header>
            <button
              onClick={() => {
                setMenu(false);
                onAction("favorite");
              }}
            >
              <ListGlyph name="star" />
              {t(space.favorite ? "unfavorite" : "favorite")}
            </button>
            <hr />
            <button
              onClick={() => {
                setMenu(false);
                onAction("name");
              }}
            >
              <ListGlyph name="edit" />
              {t("rename")}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onAction("icon");
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="8" cy="8" r="1.5" />
                <path d="m4 17 5-5 4 4 3-3 5 5" />
              </svg>
              {t("icon")}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onAction("all");
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path
                  d="m9 3-.5 3-3 1L3 6l-2 4 2.5 2v2L1 16l2 4 3-1 2.5 1 .5 3h5l.5-3 3-1 2.5 1 2-4-2.5-2v-2L22 10l-2-4-3 1-2.5-1L14 3Z"
                  transform="translate(1 -1) scale(.9)"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t("settings")}
            </button>
            <hr />
            <a
              href={`/w/${space.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ListGlyph name="open" />
              {t("newTab")}
            </a>
            <hr />
            <div className="rail-space-activity">
              <span>{t("lastEdit")}</span>
              {space.editedAt ? (
                <>
                  <strong>{space.editedBy}</strong>
                  <time dateTime={new Date(space.editedAt).toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(space.editedAt)}
                  </time>
                </>
              ) : (
                <span>{t("noActivity")}</span>
              )}
            </div>
            <div className="rail-keyboard-order">
              <button onClick={() => onMove(-1)}>
                <ListGlyph name="up" />
                {t("up")}
              </button>
              <button onClick={() => onMove(1)}>
                <ListGlyph name="down" />
                {t("down")}
              </button>
            </div>
          </div>
        </Popover>
      )}
      {position &&
        !menu &&
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
    </div>
  );
}

function LinkProgress({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 180);
    return () => clearTimeout(timer);
  }, [pending]);
  return visible ? (
    <span className="rail-space-loading" role="status" aria-label={label} />
  ) : null;
}
