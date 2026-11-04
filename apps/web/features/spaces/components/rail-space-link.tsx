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
  const anchor = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPosition({ left: Math.max(8, r.left), top: r.top - 8 });
  };
  return (
    <div className="rail-space-item">
      <Link
        href={`/w/${space.slug}`}
        style={{
          background: space.background || undefined,
          color:
            space.background &&
            parseInt(space.background.slice(1, 3), 16) * 0.299 +
              parseInt(space.background.slice(3, 5), 16) * 0.587 +
              parseInt(space.background.slice(5, 7), 16) * 0.114 <
              140
              ? "#ffffff"
              : undefined,
        }}
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
      <button
        ref={anchor}
        className="rail-space-more"
        aria-label={t("options", { name: space.name })}
        aria-haspopup="dialog"
        aria-expanded={menu}
        onClick={() => {
          setPosition(null);
          setMenu(!menu);
        }}
      >
        <ListGlyph name="more" />
      </button>
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
            <strong>{space.name}</strong>
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
              <ListGlyph name="edit" />
              {t("icon")}
            </button>
            <button
              onClick={() => {
                setMenu(false);
                onAction("all");
              }}
            >
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
              <button onClick={() => onMove(-1)}>{t("up")}</button>
              <button onClick={() => onMove(1)}>{t("down")}</button>
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
