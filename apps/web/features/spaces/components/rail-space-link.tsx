"use client";
import { Image, Settings } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect, type RefObject } from "react";
import { Popover } from "@/features/lists/components/overlays";
import { ListGlyph } from "@/features/lists/components/list-icon";
import { useLocale, useTranslations } from "next-intl";
import type { DashboardSpace } from "../types/dashboard.types";
import { spaceTileStyle } from "../utils/space-colors";
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
  const t = useTranslations("spaceRail");
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
  const tileStyle = spaceTileStyle(space.background, space.iconColor);
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
      {active && <span className="rail-selection-mark" aria-hidden="true" />}
      {menu && (
        <SpaceActionsPopover
          space={space}
          anchor={anchor}
          onAction={onAction}
          onMove={onMove}
          onClose={() => {
            setMenu(false);
            anchor.current?.focus();
          }}
        />
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

export function SpaceActionsPopover({
  space,
  anchor,
  onAction,
  onClose,
  onMove,
}: {
  space: DashboardSpace;
  anchor: RefObject<HTMLElement | null>;
  onAction: (action: "favorite" | "name" | "icon" | "all") => void;
  onClose: () => void;
  onMove?: (direction: number) => void;
}) {
  const t = useTranslations("spaceRail");
  const locale = useLocale();
  const tileStyle = spaceTileStyle(space.background, space.iconColor);
  return (
    <Popover anchor={anchor} label={space.name} onClose={onClose}>
      <div className="rail-space-menu">
        <header className="rail-menu-identity">
          <span style={tileStyle}>
            <SpaceSymbol value={space.icon} />
          </span>
          <strong>{space.name}</strong>
        </header>
        <button
          onClick={() => {
            onClose();
            onAction("favorite");
          }}
        >
          <ListGlyph name="star" />
          {t(space.favorite ? "unfavorite" : "favorite")}
        </button>
        <hr />
        <button
          onClick={() => {
            onClose();
            onAction("name");
          }}
        >
          <ListGlyph name="edit" />
          {t("rename")}
        </button>
        <button
          onClick={() => {
            onClose();
            onAction("icon");
          }}
        >
          <Image size="1em" strokeWidth={1.7} aria-hidden="true" />
          {t("icon")}
        </button>
        <button
          onClick={() => {
            onClose();
            onAction("all");
          }}
        >
          <Settings size="1em" strokeWidth={1.7} aria-hidden="true" />
          {t("settings")}
        </button>
        <hr />
        <a href={`/w/${space.slug}`} target="_blank" rel="noopener noreferrer">
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
        {onMove && (
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
        )}
      </div>
    </Popover>
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
