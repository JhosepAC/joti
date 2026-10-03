"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LOCALES, LOCALE_LABELS, type AppLocale } from "./config";
import { useLocaleSwitcher } from "./use-locale-switcher";

/**
 * Global settings menu, always visible at the bottom-left of every screen.
 * Opens upward; the "Language" row expands inline to switch locales.
 */
export const SettingsMenu: React.FC = () => {  const t = useTranslations("common.settings");
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

  const row: React.CSSProperties = {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 500,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div ref={containerRef} style={{ position: "fixed", left: 16, bottom: 16, zIndex: 50 }}>
      <div
        role="menu"
        aria-label={t("menu")}
        style={{
          position: "absolute",
          bottom: "100%",
          left: 0,
          marginBottom: 8,
          width: 240,
          borderRadius: 16,
          border: "1px solid #e5e5e5",
          background: "#fff",
          padding: 8,
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(8px)",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 150ms, transform 150ms",
        }}
      >
        <button type="button" role="menuitem" onClick={() => setLangOpen((p) => !p)} aria-expanded={langOpen} style={row}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z" />
          </svg>
          <span style={{ flex: 1 }}>{t("language")}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" style={{ transform: langOpen ? "rotate(180deg)" : "none" }}>
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
        {langOpen && (
          <div role="group" aria-label={t("language")} style={{ padding: "4px 4px 0" }}>
            {LOCALES.map((code: AppLocale) => {
              const active = code === locale;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchLocale(code)}
                  aria-pressed={active}
                  style={{
                    ...row,
                    borderRadius: 8,
                    background: active ? "#111" : "transparent",
                    color: active ? "#fff" : "#333",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span>{LOCALE_LABELS[code]}</span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path d="m4.5 12.5 5 5 10-11" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("button")}
        title={t("button")}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          fontSize: 20,
          borderRadius: 16,
          border: "1px solid #e5e5e5",
          background: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          cursor: "pointer",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
    </div>
  );
};
