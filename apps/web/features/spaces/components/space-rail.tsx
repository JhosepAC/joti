"use client";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import type { DashboardSpace } from "../types/dashboard.types";
import { RailSpaceLink } from "./rail-space-link";
import { SpaceSettings } from "./space-settings";
type Input = {
  name?: string;
  icon?: string;
  description?: string;
  modules?: string[];
  favorite?: boolean;
  background?: string;
  order?: string[];
};
export function SpaceRail({
  spaces,
  slug,
  configure,
}: {
  spaces: DashboardSpace[];
  slug: string;
  configure: (input: Input, target?: string) => Promise<void>;
}) {
  const t = useTranslations("spaceRail");
  const [items, setItems] = useState(spaces),
    [drag, setDrag] = useState<string | null>(null),
    [target, setTarget] = useState<string | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
    space: DashboardSpace;
    mode: "name" | "icon" | "all";
  } | null>(null);
  useEffect(() => setItems(spaces), [spaces]);
  const slots = useRef(new Map<string, HTMLDivElement>()),
    positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    for (const [key, el] of slots.current) {
      const before = positions.current.get(key);
      if (
        before !== undefined &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const delta = before - el.getBoundingClientRect().top;
        if (delta)
          el.animate(
            [
              { transform: `translateY(${delta}px)` },
              { transform: "translateY(0)" },
            ],
            { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
      }
    }
    positions.current.clear();
  }, [items]);
  async function move(from: string, to: string) {
    if (busy || from === to) return;
    const next = [...items],
      a = next.findIndex((s) => s.slug === from),
      b = next.findIndex((s) => s.slug === to);
    if (a < 0 || b < 0) return;
    next.splice(b, 0, next.splice(a, 1)[0]!);
    for (const [key, el] of slots.current)
      positions.current.set(key, el.getBoundingClientRect().top);
    setItems(next);
    setBusy(true);
    setError(false);
    try {
      await configure({ order: next.map((s) => s.slug) });
    } catch {
      setItems(items);
      setError(true);
    } finally {
      setBusy(false);
      setTarget(null);
      setDrag(null);
    }
  }
  return (
    <>
      {items.map((space, index) => (
        <div
          ref={(el) => {
            if (el) slots.current.set(space.slug, el);
            else slots.current.delete(space.slug);
          }}
          className="rail-space-slot"
          key={space.slug}
          data-drop={
            target === space.slug
              ? items.findIndex((s) => s.slug === drag) < index
                ? "after"
                : "before"
              : undefined
          }
          data-dragging={drag === space.slug ? "true" : undefined}
          draggable={!busy}
          onDragStart={(e) => {
            setDrag(space.slug);
            e.dataTransfer.setData("text/plain", space.slug);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (drag && drag !== space.slug) {
              e.preventDefault();
              setTarget(space.slug);
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (drag) void move(drag, space.slug);
          }}
          onDragEnd={() => {
            setDrag(null);
            setTarget(null);
          }}
        >
          <RailSpaceLink
            space={space}
            active={space.slug === slug}
            onMove={(direction) => {
              const to = items[index + direction];
              if (to) void move(space.slug, to.slug);
            }}
            onAction={(action) => {
              if (action === "favorite") {
                if (busy) return;
                setBusy(true);
                void configure({ favorite: !space.favorite }, space.slug)
                  .catch(() => setError(true))
                  .finally(() => setBusy(false));
              } else setEditor({ space, mode: action });
            }}
          />
        </div>
      ))}
      {error && (
        <p className="rail-space-error" role="alert">
          {t("error")}
        </p>
      )}
      {editor && (
        <SpaceSettings
          space={editor.space}
          mode={editor.mode}
          save={(input) => configure(input, editor.space.slug)}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
