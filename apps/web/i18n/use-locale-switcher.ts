"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  isAppLocale,
  type AppLocale,
} from "./config";

/**
 * Switches the active locale everywhere: cookie (server reads it on the next
 * render), localStorage (client backup), `<html lang>`, then a refresh so the
 * server serves the new dictionary. No URL changes involved.
 */
export function useLocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const switchLocale = useCallback(
    (next: AppLocale) => {
      if (!isAppLocale(next) || next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // Private mode: cookie alone is enough.
      }
      document.documentElement.lang = next;
      router.refresh();
    },
    [locale, router],
  );

  return { locale, switchLocale };
}
