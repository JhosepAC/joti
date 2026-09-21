import { RegisterPayload, ValidationErrors } from "../types/auth.types";

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

export function validateRegisterPayload(payload: RegisterPayload): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const errors: ValidationErrors = {};

  const email = payload.email.trim().toLowerCase();
  const password = payload.password;
  const username = payload.username.trim().toLowerCase();
  const displayName = payload.displayName.trim();
  const bio = payload.bio?.trim();

  if (!email) errors.email = "Email is required";
  else if (email.length > 320) errors.email = "Email must not exceed 320 characters";
  else if (/\s/.test(email)) errors.email = "Email must not contain spaces";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Please enter a valid email address";

  if (!password) errors.password = "Password is required";
  else if (password.length < 12) errors.password = "Password must be at least 12 characters";
  else if (password.length > 128) errors.password = "Password must not exceed 128 characters";
  else if (password.toLowerCase().includes(email.split("@")[0] ?? "" ) && (email.split("@")[0]?.length ?? 0) >= 3) {
    errors.password = "Password must not contain your email";
  } else if (username && password.toLowerCase().includes(username) && username.length >= 3) {
    errors.password = "Password must not contain your username";
  }

  if (!username) errors.username = "Username is required";
  else if (username.length < 3 || username.length > 20) errors.username = "Username must be 3-20 characters";
  else if (!USERNAME_REGEX.test(username)) errors.username = "Username may only contain a-z, 0-9 and _";
  else if (RESERVED.has(username)) errors.username = "This username is reserved";

  if (!displayName) errors.displayName = "Display name is required";
  else if (displayName.length > 100) errors.displayName = "Display name must not exceed 100 characters";
  else if (/[\u0000-\u001F\u007F-\u009F]/.test(displayName)) errors.displayName = "Display name contains invalid characters";

  if (bio && bio.length > 500) errors.bio = "Bio must not exceed 500 characters";
  else if (bio && /[\u0000-\u001F\u007F-\u009F]/.test(bio)) errors.bio = "Bio contains invalid characters";

  return { isValid: Object.keys(errors).length === 0, errors };
}
