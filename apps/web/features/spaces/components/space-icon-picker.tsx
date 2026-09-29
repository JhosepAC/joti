"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, PencilIcon } from "./icons";
import { SPACE_ICON_CHOICES, type SpaceIconChoice } from "../types/space.types";

interface SpaceIconPickerProps {
  value: SpaceIconChoice;
  onChange: (icon: SpaceIconChoice) => void;
}

/**
 * Circular button that opens the emoji picker.
 *
 * The emoji are the one place the product is allowed to use them; the trigger
 * itself is an icon, so the control is legible before anything is selected.
 *
 * The popup is a group of toggle buttons rather than a `listbox`: a listbox
 * obliges the component to own a single tab stop and drive `aria-activedescendant`
 * itself, and with nine options that is complexity with no benefit. Focus is moved
 * into the popup when it opens and returned to the trigger when it closes, so the
 * keyboard path is complete either way.
 */
export const SpaceIconPicker: React.FC<SpaceIconPickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the current selection so a keyboard user lands on the meaningful
    // option rather than the first one in the grid.
    const selected = containerRef.current?.querySelector<HTMLButtonElement>(
      '[data-selected="true"]',
    );
    const first = containerRef.current?.querySelector<HTMLButtonElement>("[data-option]");
    (selected ?? first)?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Cambiar el ícono del espacio"
        className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center text-2xl transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span aria-hidden="true">{value}</span>
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 w-[248px] rounded-2xl border border-border bg-background p-3 shadow-lg shadow-black/5">
          <p className="mb-2 text-[11px] font-medium text-text-muted">Íconos sugeridos</p>
          <div role="group" aria-label="Íconos sugeridos" className="grid grid-cols-5 gap-1.5">
            {SPACE_ICON_CHOICES.map((icon) => {
              const selected = icon === value;
              return (
                <button
                  key={icon}
                  type="button"
                  data-option=""
                  data-selected={selected}
                  aria-pressed={selected}
                  aria-label={`Usar ${icon}`}
                  onClick={() => {
                    onChange(icon);
                    // Focus goes back to the trigger: the popup is gone and the
                    // value it changed is now shown on the trigger itself.
                    close(true);
                  }}
                  className={`relative h-10 w-10 rounded-full flex items-center justify-center text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                    selected ? "bg-surface-hover ring-1 ring-primary" : "hover:bg-surface"
                  }`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-white"
                    >
                      <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-text-muted">
            <PencilIcon className="text-[11px]" />
            Puedes cambiarlo más adelante.
          </p>
        </div>
      )}
    </div>
  );
};
