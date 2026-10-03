"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_LABELS, type AppLocale } from "@/i18n/config";
import { useLocaleSwitcher } from "@/i18n/use-locale-switcher";
import { CheckIcon, GlobeIcon } from "@/features/spaces/components/icons";

function GearIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      className={className}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

/**
 * Global settings menu, always visible at the bottom-left of every screen.
 * Opens upward; the "Language" row expands inline to switch locales.
 * Rendered once in the root layout so it exists on every interface.
 */
export const SettingsMenu: React.FC = () => {
  const t = useTranslations("common.settings");
  const { locale, switchLocale } = useLocaleSwitcher();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setLangOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <div ref={containerRef} className="fixed bottom-4 left-4 z-50">
      {/* Menu panel, opens upward */}
      <div
        role="menu"
        aria-label={t("menu")}
        className={cn(
          "absolute bottom-full left-0 mb-2 w-60 origin-bottom-left rounded-2xl border border-border bg-surface p-2 shadow-xl shadow-black/10 transition-all duration-150",
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => setLangOpen((prev) => !prev)}
          aria-expanded={langOpen}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-background"
        >
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-icon ring-1 ring-border">
            <GlobeIcon className="text-base" />
          </span>
          <span className="flex-1 text-left">{t("language")}</span>
          <ChevronIcon
            className={cn("text-sm text-text-muted transition-transform duration-150", langOpen && "rotate-180")}
          />
        </button>

        {/* Expandable language options */}
        <div
          className={cn(
            "grid transition-all duration-150",
            langOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-1 pb-1 pt-1" role="group" aria-label={t("language")}>
              {LOCALES.map((code: AppLocale) => {
                const active = code === locale;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => switchLocale(code)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary font-medium text-white"
                        : "font-light text-text-secondary hover:bg-background hover:text-text-primary",
                    )}
                  >
                    <span>{LOCALE_LABELS[code]}</span>
                    {active && (
                      <span aria-hidden="true" className="inline-flex">
                        <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Gear trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("button")}
        title={t("button")}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface text-xl text-icon shadow-lg shadow-black/10 transition-colors hover:border-border-strong hover:text-icon-hover"
      >
        <GearIcon />
      </button>
    </div>
  );
};
