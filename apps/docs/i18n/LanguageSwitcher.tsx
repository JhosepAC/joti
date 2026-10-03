"use client";

import { LOCALES, LOCALE_LABELS, type AppLocale } from "./config";
import { useLocaleSwitcher } from "./use-locale-switcher";

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, switchLocale } = useLocaleSwitcher();

  return (
    <div className={className} role="group" aria-label="Idioma / Language">
      {LOCALES.map((code: AppLocale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchLocale(code)}
            aria-pressed={active}
            aria-label={`${LOCALE_LABELS[code]}${active ? " (actual / current)" : ""}`}
            style={{
              fontWeight: active ? 700 : 400,
              textDecoration: active ? "underline" : "none",
              marginRight: 8,
              cursor: "pointer",
            }}
          >
            {LOCALE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
};
