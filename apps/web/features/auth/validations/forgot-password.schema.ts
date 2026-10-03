import { ValidationErrors } from "../types/auth.types";
import type { ValidationTranslator } from "@/i18n/translate";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateForgotPasswordEmail(
  email: string,
  t: ValidationTranslator,
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const normalized = email.trim().toLowerCase();
  if (!normalized) errors.email = t("email.required");
  else if (normalized.length > 320) errors.email = t("email.tooLong");
  else if (/\s/.test(normalized)) errors.email = t("email.noSpaces");
  else if (!EMAIL_REGEX.test(normalized)) errors.email = t("email.invalid");
  return { isValid: Object.keys(errors).length === 0, errors };
}
