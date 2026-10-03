import { ValidationErrors } from "../types/auth.types";
import type { ValidationTranslator } from "@/i18n/translate";

export function validateResetPasswordInput(
  input: {
    password: string;
    confirmPassword: string;
    email?: string;
    username?: string;
  },
  t: ValidationTranslator,
): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const { password, confirmPassword, email, username } = input;

  if (!password) errors.password = t("password.required");
  else if (password.length < 12) errors.password = t("password.tooShort");
  // Bytes, not chars: the server caps passwords at 72 UTF-8 bytes (bcrypt limit).
  else if (new TextEncoder().encode(password).length > 72) errors.password = t("password.tooLongBytes");
  else if (email) {
    const localPart = email.split("@")[0]?.toLowerCase() ?? "";
    if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      errors.password = t("password.containsEmail");
    }
  }

  if (username && password.toLowerCase().includes(username.toLowerCase()) && username.length >= 3) {
    errors.password = t("password.containsUsername");
  }

  if (!confirmPassword) errors.confirmPassword = t("password.confirmRequired");
  else if (password !== confirmPassword) errors.confirmPassword = t("password.mismatch");

  return { isValid: Object.keys(errors).length === 0, errors };
}
