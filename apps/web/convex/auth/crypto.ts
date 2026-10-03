"use node";

import bcrypt from "bcryptjs";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { BCRYPT_COST } from "./constants";

// ---------------------------------------------------------------------------
// SECURITY: everything in convex/ that is `export`ed becomes part of the PUBLIC
// API and is callable by anyone on the internet. These helpers are therefore
// plain module functions (NOT Convex `action`s) so they are never exposed.
// ---------------------------------------------------------------------------

// --- Password hashing ---
// bcryptjs (pure JS) because Convex' esbuild bundler cannot load the native
// .node bindings required by @node-rs/argon2. Cost 12 is OWASP-approved.

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * A real bcrypt hash of a value nobody knows, used to equalize response time on
 * the "account does not exist" path so login duration does not leak whether an
 * address is registered. It is a valid hash, so `bcrypt.compare` performs the
 * same work it would for a genuine account.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$1pawnVJPZnMxGGHyfijNnO0bFw.kpZ3ooYP7985g2EtehWyOzKE42";

/**
 * Burns the same CPU as a real password check without ever affecting the result.
 * Failures are swallowed on purpose: this is a side-effect-only defence against
 * timing oracles and must not change the caller's control flow.
 */
export async function equalizePasswordTiming(password: string): Promise<void> {
  try {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
  } catch {
    // Intentionally ignored.
  }
}

// --- Token encryption at rest (AES-256-GCM) ---

const KEY_BYTES = 32;
const TOKEN_VERSION = "v1";

/**
 * Resolves TOKEN_ENCRYPTION_KEY. Throws instead of degrading to a weak or
 * absent key: a silent no-op here would store OAuth tokens in plaintext.
 */
function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Refusing to store OAuth tokens unencrypted.",
    );
  }
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const fromBase64 = Buffer.from(trimmed, "base64");
  if (fromBase64.length === KEY_BYTES) {
    return fromBase64;
  }
  throw new Error(
    "TOKEN_ENCRYPTION_KEY must be exactly 32 bytes, encoded as 64 hex characters or base64.",
  );
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    TOKEN_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptToken(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    throw new Error("Malformed encrypted token payload.");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parts[1] as string, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parts[2] as string, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parts[3] as string, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// --- Digests ---

export function sha256Hex(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Resolves EMAIL_CODE_PEPPER. Throws instead of degrading to an unpeppered
 * digest: a silent no-op here would store 6-digit codes under a fast,
 * unsalted hash that any database dump can brute-force offline (1M space).
 */
function getCodePepper(): string {
  const raw = process.env.EMAIL_CODE_PEPPER;
  if (!raw || raw.trim().length < 32) {
    throw new Error(
      "EMAIL_CODE_PEPPER is not set (or shorter than 32 characters). " +
        "Refusing to store verification codes under a brute-forceable digest.",
    );
  }
  return raw.trim();
}

/**
 * Digest stored for email verification codes. The server-side pepper means a
 * leaked table alone is not enough to recover codes offline; it is mixed in
 * with a domain separator so the digest cannot be confused with any other
 * SHA-256 value in the database.
 */
export function hashEmailCode(code: string): string {
  return sha256Hex(`joti-email-code-v1:${getCodePepper()}:${code}`);
}

/**
 * Pre-pepper digest, accepted only so rows written before the pepper was
 * introduced still verify until they expire (10 minutes). New rows are always
 * peppered; re-issuance migrates the address automatically.
 */
export function hashEmailCodeLegacy(code: string): string {
  return sha256Hex(code);
}

/** Raw claim-grant token: 32 bytes of CSPRNG entropy, base64url encoded. */
export function issueClaimGrant(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time string comparison for secrets of equal expected length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length mismatches are not measurably faster.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
