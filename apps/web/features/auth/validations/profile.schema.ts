import type { ValidationErrors } from "../types/auth.types";
import type { ValidationTranslator } from "@/i18n/translate";
import { RESERVED_USERNAMES } from "../../../convex/auth/constants";

export function validateProfileInput(
  input: { username: string; displayName: string; bio: string },
  t: ValidationTranslator,
): ValidationErrors {
  const errors: ValidationErrors = {};
  const username = input.username.trim().toLowerCase();
  const name = input.displayName.trim();
  if (!username) errors.username = t("username.required");
  else if (username.length < 3 || username.length > 20)
    errors.username = t("username.length");
  else if (!/^[a-z0-9_]+$/.test(username))
    errors.username = t("username.charset");
  else if (RESERVED_USERNAMES.has(username))
    errors.username = t("username.reserved");
  if (!name) errors.displayName = t("displayName.required");
  else if (name.length > 100) errors.displayName = t("displayName.tooLong");
  else if (/[\u0000-\u001f\u007f-\u009f]/.test(name))
    errors.displayName = t("displayName.invalidChars");
  if (input.bio.trim().length > 500) errors.bio = t("bio.tooLong");
  else if (/[\u0000-\u001f\u007f-\u009f]/.test(input.bio))
    errors.bio = t("bio.invalidChars");
  return errors;
}
