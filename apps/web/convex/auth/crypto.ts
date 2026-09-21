"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "./constants";

// ──────────────────────────────────────────────────────────
// Password hashing — bcryptjs (pure JS, compatible with Convex Node runtime)
// Previously Argon2id via @node-rs/argon2 required native .node bindings
// which Convex bundler (esbuild) cannot load. bcrypt with cost 12 is OWASP-approved
// alternative; swap to Argon2id via @noble/hashes/argon2 if needed later.
// ──────────────────────────────────────────────────────────

export const hashPassword = action({
  args: { password: v.string() },
  handler: async (_, args) => {
    const salt = await bcrypt.genSalt(BCRYPT_COST);
    return await bcrypt.hash(args.password, salt);
  },
});

export const verifyPassword = action({
  args: { password: v.string(), hash: v.string() },
  handler: async (_, args) => {
    return await bcrypt.compare(args.password, args.hash);
  },
});

// ──────────────────────────────────────────────────────────
// Token encryption — AES-256-GCM for OAuth tokens at rest
// Uses Node `crypto`; key must be set as CONVEX env TOKEN_ENCRYPTION_KEY (32 bytes hex/base64)
// Falls back to no-op in dev if key is missing.
// ──────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const buf = Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  } catch {
    // ignore
  }
  const buf = Buffer.alloc(32);
  Buffer.from(raw, "utf8").copy(buf);
  return buf;
}

export const encryptToken = action({
  args: { token: v.string() },
  handler: async (_, args) => {
    const key = getEncryptionKey();
    if (!key) return args.token;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(args.token, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
  },
});

export const decryptToken = action({
  args: { encrypted: v.string() },
  handler: async (_, args) => {
    const key = getEncryptionKey();
    if (!key) return args.encrypted;
    const parts = args.encrypted.split(":");
    if (parts.length !== 3) return args.encrypted;
    const [ivB64, tagB64, dataB64] = parts as [string, string, string];
    const iv = Buffer.from(ivB64!, "base64");
    const tag = Buffer.from(tagB64!, "base64");
    const data = Buffer.from(dataB64!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  },
});
