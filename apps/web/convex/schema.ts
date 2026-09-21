import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Core auth user — holds credentials & security state.
   * Uses Convex native _id and _creationTime (replaces UUID/created_at).
   */
  auth_users: defineTable({
    email: v.string(), // normalized lowercase, unique (case-insensitive)
    password_hash: v.optional(v.string()), // undefined for OAuth-only accounts
    email_verified_at: v.optional(v.number()), // ms timestamp, null until verified
    last_login_at: v.optional(v.number()),
    failed_login_attempts: v.number(), // default 0
    locked_until: v.optional(v.number()), // ms timestamp
    deleted_at: v.optional(v.number()), // soft delete
  }).index("by_email", ["email"]),

  /**
   * Public profile — 1:1 with auth_users.
   */
  auth_user_profiles: defineTable({
    user_id: v.id("auth_users"),
    username: v.string(), // normalized lowercase [a-z0-9_], 3-20 chars, unique
    display_name: v.string(), // 1-100 chars, unicode, trimmed
    avatar: v.optional(v.string()), // https URL or storage id
    bio: v.optional(v.string()), // max 500 chars
    locale: v.string(), // e.g. "en", "es", "system"
    timezone: v.string(), // IANA tz or "system"
  })
    .index("by_user_id", ["user_id"])
    .index("by_username", ["username"]),

  /**
   * OAuth linkage — currently Google only.
   * Tokens are stored encrypted at rest (AES-256-GCM via crypto action).
   */
  auth_oauth_accounts: defineTable({
    user_id: v.id("auth_users"),
    provider: v.union(v.literal("google")),
    provider_account_id: v.string(), // immutable id from provider
    provider_email: v.optional(v.string()),
    access_token_encrypted: v.optional(v.string()),
    refresh_token_encrypted: v.optional(v.string()),
    token_expires_at: v.optional(v.number()), // ms timestamp
  })
    .index("by_user_id", ["user_id"])
    .index("by_provider_and_account", ["provider", "provider_account_id"])
    .index("by_provider_email", ["provider_email"]),
});
