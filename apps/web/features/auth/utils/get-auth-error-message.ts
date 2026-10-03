/**
 * Centralized mapper to prevent leaking raw Convex server logs to UI.
 * Convex client errors often arrive as:
 *   "[CONVEX A(auth/actions:login)] [Request ID: ...] Server Error Uncaught ConvexError: Invalid email or password. Called by client"
 * We extract the user-facing message and map known codes to friendly text.
 */

const CODE_MESSAGE_MAP: Record<string, string> = {
  VALIDATION_ERROR: "Please check your input and try again.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in. Check your inbox for the code.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  RATE_LIMITED: "Please wait a moment before trying again.",
  EMAIL_DELIVERY_FAILED: "We could not send the email. Please try again later.",
};

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
  if (convexIdx !== -1) msg = msg.slice(convexIdx + "ConvexError:".length).trim();
  // Collapse whitespace
  msg = msg.replace(/\s+/g, " ").trim();
  return msg || "Something went wrong. Please try again.";
}

export function getAuthErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;
  if (err instanceof Error) {
    const data = (err as Error & { data?: { code?: string; message?: string } }).data;
    // Known code mapping first
    if (data?.code && CODE_MESSAGE_MAP[data.code]) {
      // Prefer explicit message if provided and not raw prefix
      if (data.message && !data.message.includes("[CONVEX")) return data.message;
      return CODE_MESSAGE_MAP[data.code] as string;
    }
    if (data?.message) return sanitizeRawMessage(data.message);
    return sanitizeRawMessage(err.message);
  }
  if (typeof err === "string") return sanitizeRawMessage(err);
  return fallback;
}

export function getAuthErrorCode(err: unknown): string | undefined {
  if (err instanceof Error) {
    const data = (err as Error & { data?: { code?: string } }).data;
    return data?.code;
  }
  return undefined;
}
