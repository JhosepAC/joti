"use client";

import { useTranslations } from "next-intl";

/**
 * String-keyed translator for the validation schemas. Schemas stay pure
 * functions of (input, t) and return translated messages, so form components
 * render `errors.*` untouched. Key existence is enforced by the
 * scripts/i18n-check parity pass plus next-intl types at the call sites.
 */
export type ValidationTranslator = (key: string) => string;

export function useValidationTranslator(): ValidationTranslator {
  const t = useTranslations("validation");
  // `never` funnels any string key into the typed translator; missing keys
  // surface through the locale parity check, not the type system.
  return (key: string) => t(key as never);
}
