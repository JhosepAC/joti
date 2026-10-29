/**
 * Centralized mapper to prevent leaking raw Convex server logs to UI.
 * Convex client errors often arrive as:
 *   "[CONVEX A(auth/actions:login)] [Request ID: ...] Server Error Uncaught ConvexError: Invalid email or password. Called by client"
 *
 * Strategy: backend contracts (codes) stay in English; presentation maps
 * codes -- and a closed list of known server messages for throws that carry
 * no code -- to i18n keys. Unknown failures use a localized fallback.
 */

import { useCallback } from "react";
import { useTranslations } from "next-intl";

const CODE_MESSAGE_MAP: Record<string, string> = {
  VALIDATION_ERROR: "validation",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  INVALID_CREDENTIALS: "invalidCredentials",
  RATE_LIMITED: "rateLimited",
  EMAIL_DELIVERY_FAILED: "deliveryFailed",
  NOT_FOUND: "spaceUnavailable",
  PROFILE_REQUIRED: "profileRequired",
  SPACE_ALREADY_EXISTS: "spaceExists",
  STORAGE_LIMIT: "storageLimit",
};

/** Known server messages from throws that carry no code. */
const SERVER_MESSAGE_MAP: Array<{ match: RegExp; key: string }> = [
  { match: /username.*(?:taken|already.*use)/i, key: "usernameTaken" },
  {
    match: /password must be different|password.*different from.*current/i,
    key: "passwordReused",
  },
  { match: /password must not.*(?:email)/i, key: "passwordEmail" },
  { match: /password must not.*username/i, key: "passwordUsername" },
  {
    match: /profile.*(?:already|exists)|already.*profile/i,
    key: "accountExists",
  },
  {
    match:
      /(?:invalid|expired|already.*used).*reset|reset.*(?:expired|already.*used)/i,
    key: "resetInvalid",
  },
  { match: /invalid email or password/i, key: "invalidCredentials" },
  { match: /invalid or expired code/i, key: "codeInvalid" },
  { match: /session expired/i, key: "sessionExpired" },
  { match: /no longer valid/i, key: "sessionInvalid" },
  { match: /not available/i, key: "spaceUnavailable" },
  { match: /too many attempts/i, key: "tooManyAttempts" },
];

function sanitizeRawMessage(raw: string): string {
  if (!raw) return "Something went wrong. Please try again.";
  // Remove Convex prefix: [CONVEX ...] [Request ID ...] Server Error Uncaught ConvexError: ... Called by client
  let msg = raw;
  // Strip leading [CONVEX ...] blocks
  msg = msg.replace(/^\s*\[CONVEX[^\]]*\]\s*/g, "");
  msg = msg.replace(/^\s*\[Request ID:[^\]]*\]\s*/g, "");
  msg = msg.replace(/^\s*Server Error\s*/i, "");
  msg = msg.replace(/^\s*Uncaught\s+(ConvexError:\s*)?/i, "");
  msg = msg.replace(/\s*Called by client\s*\.?\s*$/i, "");
  msg = msg.trim();
  // If still contains ConvexError: prefix somewhere, extract after
  const convexIdx = msg.indexOf("ConvexError:");
  if (convexIdx !== -1)
    msg = msg.slice(convexIdx + "ConvexError:".length).trim();
  // Collapse whitespace
  msg = msg.replace(/\s+/g, " ").trim();
  return msg || "Something went wrong. Please try again.";
}

export function getAuthErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!err) return fallback;
  if (err instanceof Error) {
    const data = (err as Error & { data?: { code?: string; message?: string } })
      .data;
    if (data?.message) return sanitizeRawMessage(data.message);
    return sanitizeRawMessage(err.message);
  }
  if (typeof err === "string") return sanitizeRawMessage(err);
  return fallback;
}

/**
 * Translated version for UI: maps codes and known server messages to the
 * `errors` namespace. Never display unknown server messages or stack traces.
 */
export function useAuthErrorMessage() {
  const t = useTranslations("errors");

  return useCallback(
    (err: unknown, fallback?: string): string => {
      const fallbackText = fallback ?? t("fallback");
      if (!err) return fallbackText;
      if (err instanceof Error) {
        const data = (
          err as Error & { data?: { code?: string; message?: string } }
        ).data;
        const known = SERVER_MESSAGE_MAP.find((entry) =>
          entry.match.test(getAuthErrorMessage(err)),
        );
        if (known) return t(known.key as Parameters<typeof t>[0]);
        if (data?.code && CODE_MESSAGE_MAP[data.code]) {
          return t(CODE_MESSAGE_MAP[data.code] as Parameters<typeof t>[0]);
        }
        return fallbackText;
      }
      if (typeof err === "string") {
        const clean = sanitizeRawMessage(err);
        const known = SERVER_MESSAGE_MAP.find((entry) =>
          entry.match.test(clean),
        );
        if (known) return t(known.key as Parameters<typeof t>[0]);
        return fallbackText;
      }
      return fallbackText;
    },
    [t],
  );
}

export function getAuthErrorCode(err: unknown): string | undefined {
  if (err instanceof Error) {
    const data = (err as Error & { data?: { code?: string } }).data;
    return data?.code;
  }
  return undefined;
}

/** Parse the backend contract before translation, which may change the unit. */
export function getRetryAfterSeconds(err: unknown, fallback = 60): number {
  const seconds = getAuthErrorMessage(err).match(
    /(?:wait\s+|after\s+)?(\d+)s\b/i,
  )?.[1];
  return seconds ? Math.max(1, Number(seconds)) : fallback;
}
