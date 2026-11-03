import { RegisterPayload, ValidationErrors } from "../types/auth.types";
import type { ValidationTranslator } from "@/i18n/translate";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]+$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "api",
  "auth",
  "login",
  "register",
  "signin",
  "signup",
  "settings",
  "dashboard",
  "joti",
  "help",
  "support",
  "terms",
  "privacy",
  "workspace",
  "null",
  "undefined",
  "system",
  "profile",
]);

export function validateRegisterPayload(
  payload: RegisterPayload,
  t: ValidationTranslator,
): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const errors: ValidationErrors = {};

  const email = payload.email.trim().toLowerCase();
  const password = payload.password;
  const username = payload.username.trim().toLowerCase();
  const displayName = payload.displayName.trim();
  const bio = payload.bio?.trim();

  if (!email) errors.email = t("email.required");
  else if (email.length > 320) errors.email = t("email.tooLong");
  else if (/\s/.test(email)) errors.email = t("email.noSpaces");
  else if (!EMAIL_REGEX.test(email)) errors.email = t("email.invalid");

  if (!password) errors.password = t("password.required");
  else if (password.length < 12) errors.password = t("password.tooShort");
  // Bytes, not chars: the server caps passwords at 72 UTF-8 bytes (bcrypt limit).
  else if (new TextEncoder().encode(password).length > 72)
    errors.password = t("password.tooLongBytes");
  else if (
    password.toLowerCase().includes(email.split("@")[0] ?? "") &&
    (email.split("@")[0]?.length ?? 0) >= 3
  ) {
    errors.password = t("password.containsEmail");
  } else if (
    username &&
    password.toLowerCase().includes(username) &&
    username.length >= 3
  ) {
    errors.password = t("password.containsUsername");
  }

  if (!username) errors.username = t("username.required");
  else if (username.length < 3 || username.length > 20)
    errors.username = t("username.length");
  else if (!USERNAME_REGEX.test(username))
    errors.username = t("username.charset");
  else if (RESERVED.has(username)) errors.username = t("username.reserved");

  if (!displayName) errors.displayName = t("displayName.required");
  else if (displayName.length > 100)
    errors.displayName = t("displayName.tooLong");
  else if (/[\u0000-\u001F\u007F-\u009F]/.test(displayName))
    errors.displayName = t("displayName.invalidChars");

  if (bio && bio.length > 500) errors.bio = t("bio.tooLong");
  else if (bio && /[\u0000-\u001F\u007F-\u009F]/.test(bio))
    errors.bio = t("bio.invalidChars");

  return { isValid: Object.keys(errors).length === 0, errors };
}
