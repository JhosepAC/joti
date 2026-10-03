"use client";

import { GlobeIcon } from "@/features/spaces/components/icons";
import { LOCALES, LOCALE_LABELS, type AppLocale } from "@/i18n/config";
import { useLocaleSwitcher } from "@/i18n/use-locale-switcher";
import { cn } from "@/lib/utils";

function GlobeSvg({ className }: { className?: string }) {
  return <GlobeIcon className={className} />;
}

export const LanguageSwitcher: React.FC<{ className?: string; compact?: boolean }> = ({  className,
  compact = false,
}) => {
  const { locale, switchLocale } = useLocaleSwitcher();

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="group"
      aria-label="Idioma / Language"
    >
      <span aria-hidden="true" className="text-text-muted">
        <GlobeSvg className="text-base" />
      </span>
      {LOCALES.map((code: AppLocale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => switchLocale(code)}
            aria-pressed={active}
            aria-label={`${LOCALE_LABELS[code]}${active ? " (actual / current)" : ""}`}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-white"
                : "text-text-secondary hover:bg-surface hover:text-text-primary",
              compact && "px-2",
            )}
          >
            {compact ? code.toUpperCase() : LOCALE_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
};
