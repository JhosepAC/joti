export const LOCALES = ["es", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const FALLBACK_LOCALE: AppLocale = "es";
export const LOCALE_COOKIE = "joti-locale";
export const LOCALE_STORAGE_KEY = "joti-locale";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  es: "Español",
  en: "English",
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function localeFromLanguageTag(tag: string | null | undefined): AppLocale {
  if (typeof tag === "string" && tag.toLowerCase().startsWith("es")) return "es";
  return "en";
}

export function resolveLocale(stored: unknown, systemTag?: string | null): AppLocale {
  if (isAppLocale(stored)) return stored;
  if (systemTag) return localeFromLanguageTag(systemTag);
  return FALLBACK_LOCALE;
}
