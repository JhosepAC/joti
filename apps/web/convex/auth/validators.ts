import { ConvexError } from "convex/values";
import {
  AVATAR_MAX_LENGTH,
  BIO_MAX_LENGTH,
  CONTROL_CHARS_REGEX,
  DISPLAY_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  EMAIL_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_REGEX,
} from "./constants";

// ──────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────

function fail(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message });
}

// ──────────────────────────────────────────────────────────
// Email — normalized to lowercase, trimmed, no internal spaces
// ──────────────────────────────────────────────────────────
export function validateEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length === 0) fail("Email is required.");
  if (trimmed.length > EMAIL_MAX_LENGTH)
    fail(`Email must not exceed ${EMAIL_MAX_LENGTH} characters.`);
  if (/\s/.test(trimmed)) fail("Email must not contain spaces.");
  if (!EMAIL_REGEX.test(trimmed)) fail("Invalid email format.");
  return trimmed.toLowerCase();
}

// ──────────────────────────────────────────────────────────
// Password — 12-128 chars, not derived from email/username, no trim lowercasing
// ──────────────────────────────────────────────────────────
export function validatePassword(
  password: string,
  email: string,
  username?: string,
): void {
  if (password.length < PASSWORD_MIN_LENGTH)
    fail(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (password.length > PASSWORD_MAX_LENGTH)
    fail(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`);

  const lowerPass = password.toLowerCase();
  const lowerEmail = email.toLowerCase();

  // Reject if password equals email or contains local-part
  if (lowerPass === lowerEmail) fail("Password must not be the same as your email.");
  const localPart = lowerEmail.split("@")[0];
  if (localPart && localPart.length >= 3 && lowerPass.includes(localPart)) {
    fail("Password must not contain your email address.");
  }

  if (username) {
    const lowerUser = username.toLowerCase();
    if (lowerPass === lowerUser) fail("Password must not be the same as your username.");
    if (lowerUser.length >= 3 && lowerPass.includes(lowerUser)) {
      fail("Password must not contain your username.");
    }
  }

  // Optional: could integrate haveibeenpwned / breached list check here (async)
}

// ──────────────────────────────────────────────────────────
// Username — normalized lowercase, [a-z0-9_], 3-20, not reserved
// ──────────────────────────────────────────────────────────
export function validateUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    fail(`Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`);
  }
  if (!USERNAME_REGEX.test(normalized)) {
    fail("Username may only contain lowercase letters, numbers, and underscores.");
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    fail("This username is reserved.");
  }
  return normalized;
}

// ──────────────────────────────────────────────────────────
// Display name — trimmed, 1-100, unicode allowed, no control chars
// ──────────────────────────────────────────────────────────
export function validateDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) fail("Display name is required.");
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH)
    fail(`Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters.`);
  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    fail("Display name must not contain control characters.");
  }
  return trimmed;
}

// ──────────────────────────────────────────────────────────
// Bio — optional, trimmed, max 500, no control chars
// ──────────────────────────────────────────────────────────
export function validateBio(bio?: string): string | undefined {
  if (bio === undefined || bio === null) return undefined;
  const trimmed = bio.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > BIO_MAX_LENGTH)
    fail(`Bio must not exceed ${BIO_MAX_LENGTH} characters.`);
  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    fail("Bio must not contain control characters.");
  }
  return trimmed;
}

// ──────────────────────────────────────────────────────────
// Avatar — optional https URL, max length
// ──────────────────────────────────────────────────────────
export function validateAvatar(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  const trimmed = avatar.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > AVATAR_MAX_LENGTH) fail("Avatar URL is too long.");
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") fail("Avatar URL must use https.");
  } catch {
    fail("Invalid avatar URL.");
  }
  return trimmed;
}

// ──────────────────────────────────────────────────────────
// Locale / Timezone — simple non-empty check, defaults handled by caller
// ──────────────────────────────────────────────────────────
export function validateLocale(locale?: string): string {
  if (!locale || locale.trim().length === 0) return "system";
  return locale.trim().slice(0, 10);
}

export function validateTimezone(timezone?: string): string {
  if (!timezone || timezone.trim().length === 0) return "system";
  return timezone.trim().slice(0, 64);
}
