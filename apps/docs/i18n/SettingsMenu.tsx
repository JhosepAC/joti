"use client";

import { Check, ChevronDown, Globe, Settings } from "lucide-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LOCALES, LOCALE_LABELS, type AppLocale } from "./config";
import { useLocaleSwitcher } from "./use-locale-switcher";

/**
 * Global settings menu, always visible at the bottom-left of every screen.
 * Opens upward; the "Language" row expands inline to switch locales.
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
  }, [open]);

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
    <div
      ref={containerRef}
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 50 }}
    >
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
        <button
          type="button"
          role="menuitem"
          onClick={() => setLangOpen((p) => !p)}
          aria-expanded={langOpen}
          style={row}
        >
          <Globe size="18" strokeWidth={1.7} aria-hidden="true" />
          <span style={{ flex: 1 }}>{t("language")}</span>
          <ChevronDown
            size="14"
            strokeWidth={1.7}
            aria-hidden="true"
            style={{ transform: langOpen ? "rotate(180deg)" : "none" }}
          />
        </button>
        {langOpen && (
          <div
            role="group"
            aria-label={t("language")}
            style={{ padding: "4px 4px 0" }}
          >
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
                    <Check size="14" strokeWidth={1.7} aria-hidden="true" />
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
        <Settings size="20" strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
  );
};
