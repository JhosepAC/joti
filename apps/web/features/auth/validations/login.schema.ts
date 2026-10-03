import { LoginCredentials, ValidationErrors } from "../types/auth.types";
import type { ValidationTranslator } from "@/i18n/translate";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginCredentials(
  credentials: LoginCredentials,
  t: ValidationTranslator,
): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const errors: ValidationErrors = {};
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  // Email Validation according to project specifications (database/auth.md)
  if (!email) {
    errors.email = t("email.required");
  } else if (email.length > 320) {
    errors.email = t("email.tooLong");
  } else if (/\s/.test(email)) {
    errors.email = t("email.noSpaces");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = t("email.invalid");
  }

  // Password — do NOT reveal policy on login (avoids user enumeration / length oracle)
  // Only check presence; actual verification is server-side with generic error
  if (!password) {
    errors.password = t("password.required");
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
