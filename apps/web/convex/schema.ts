import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { eventFields } from "./calendar/model";
import {
  column as listColumn,
  view as listView,
  cellValue,
} from "./lists/model";

export default defineSchema({
  calendar_events: defineTable({
    ...eventFields,
    space_id: v.id("spaces"),
    key: v.string(),
    revision: v.number(),
    startsAt: v.number(),
    endsAt: v.number(),
  })
    .index("by_space", ["space_id"])
    .index("by_space_key", ["space_id", "key"]),
  calendar_operations: defineTable({
    space_id: v.id("spaces"),
    op_id: v.string(),
    hash: v.string(),
    created_at: v.number(),
  })
    .index("by_space_op", ["space_id", "op_id"])
    .index("by_created", ["created_at"]),
  list_catalog: defineTable({
    favorite: v.optional(v.boolean()),
    space_id: v.id("spaces"),
    list_id: v.id("space_lists"),
    key: v.string(),
    name: v.string(),
    icon: v.string(),
    archived: v.boolean(),
    revision: v.number(),
  })
    .index("by_space", ["space_id"])
    .index("by_list", ["list_id"]),
  list_access: defineTable({
    token_hash: v.string(),
    session_id: v.id("auth_sessions"),
    user_id: v.id("auth_users"),
    space_id: v.id("spaces"),
    expires_at: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_session", ["session_id"])
    .index("by_expires_at", ["expires_at"]),
  space_lists: defineTable({
    favorite: v.optional(v.boolean()),
    space_id: v.id("spaces"),
    key: v.string(),
    name: v.string(),
    description: v.string(),
    icon: v.string(),
    columns: v.array(listColumn),
    views: v.array(listView),
    revision: v.number(),
    archived: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_space", ["space_id"])
    .index("by_space_key", ["space_id", "key"]),
  list_rows: defineTable({
    space_id: v.id("spaces"),
    list_id: v.id("space_lists"),
    key: v.string(),
    cells: v.record(v.string(), cellValue),
    versions: v.record(v.string(), v.number()),
    icon: v.string(),
    notes: v.string(),
    meta_version: v.number(),
    position: v.number(),
    archived: v.boolean(),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_list", ["list_id"])
    .index("by_list_key", ["list_id", "key"]),
  list_operations: defineTable({
    user_id: v.id("auth_users"),
    space_id: v.id("spaces"),
    op_id: v.string(),
    created_at: v.number(),
  })
    .index("by_user_op", ["user_id", "op_id"])
    .index("by_created_at", ["created_at"]),
  /** Opaque browser sessions. Raw tokens are held only in HttpOnly cookies. */
  auth_sessions: defineTable({
    token_hash: v.string(),
    user_id: v.id("auth_users"),
    expires_at: v.number(),
    created_at: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_user_id", ["user_id"])
    .index("by_expires_at", ["expires_at"]),
  /**
   * Core auth user - holds credentials & security state.
   * Uses Convex native _id and _creationTime (replaces UUID/created_at).
   */
  auth_users: defineTable({
    email: v.string(), // normalized lowercase, unique (case-insensitive)
    password_hash: v.optional(v.string()), // undefined for OAuth-only accounts
    email_verified_at: v.optional(v.number()), // ms timestamp, absent until verified
    last_login_at: v.optional(v.number()),
    failed_login_attempts: v.number(), // default 0
    locked_until: v.optional(v.number()), // ms timestamp
    deleted_at: v.optional(v.number()), // soft delete
  }).index("by_email", ["email"]),

  /**
   * Public profile - 1:1 with auth_users.
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
   * OAuth linkage - currently Google only.
   * Tokens are stored encrypted at rest (AES-256-GCM via auth/crypto.ts).
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

  /**
   * Email verification codes - ephemeral, for step 1.1 of registration.
   * The 6-digit code is stored ONLY as a SHA-256 digest; `code` is kept
   * optional purely for legacy rows written before hashing was introduced.
   */
  auth_email_verifications: defineTable({
    email: v.string(), // normalized lowercase
    code: v.optional(v.string()), // legacy plaintext, always undefined on new rows
    code_hash: v.optional(v.string()), // peppered SHA-256 hex of the 6-digit code (see auth/crypto hashEmailCode)
    expires_at: v.number(), // ms timestamp
    attempts: v.number(), // default 0
    verified_at: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_email_and_code_hash", ["email", "code_hash"]),

  /**
   * Password reset tokens - one-time link, expires in 1 hour.
   * Token is stored hashed (SHA-256 hex) to avoid plaintext leakage.
   */
  auth_password_resets: defineTable({
    user_id: v.id("auth_users"),
    email: v.string(), // normalized lowercase, denormalized for email dispatch
    token_hash: v.string(), // SHA-256 hex of raw token
    expires_at: v.number(), // ms timestamp
    used_at: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_user_id", ["user_id"])
    .index("by_email", ["email"]),

  /**
   * Generic fixed-window rate limiter.
   * `key` namespaces a limit, e.g. "reset:<email>" or "upload:<email>".
   * Rows are swept opportunistically by the caller.
   */
  auth_rate_limits: defineTable({
    key: v.string(),
    window_start: v.number(), // ms timestamp of the current window
    count: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Short-lived proof that the caller controls an address, and — for the `space`
   * scope — that they may act on one specific space.
   *
   * Issued only after a successful password check (`actions.login`) or a
   * successful email-code redemption (`verification.confirmEmailCode`), and
   * required by `actions.completeProfile`, `auth.storage.generateAvatarUploadUrl`
   * and the spaces actions.
   *
   * These scoped grants bridge browser sessions to Convex operations.
   * Without an explicit authorization, knowing a verified address was enough to
   * claim that account's profile or mint avatar upload URLs. The token is stored
   * hashed, expires in 15 minutes, and is never logged. See auth/README.md.
   */
  auth_claim_grants: defineTable({
    token_hash: v.string(), // SHA-256 hex of the raw grant
    email: v.string(), // normalized lowercase
    user_id: v.optional(v.id("auth_users")), // set when the account already exists
    scope: v.string(), // "account" | "space" -- see auth/constants.ts
    space_id: v.optional(v.id("spaces")), // set only for the "space" scope
    issued_at: v.number(),
    expires_at: v.number(),
  })
    .index("by_token_hash", ["token_hash"])
    .index("by_email", ["email"])
    .index("by_scope_and_email", ["scope", "email"]),

  /**
   * A workspace, owned by exactly one user.
   *
   * The `purpose` is the only stored setup decision: the template that seeds the
   * space and the tools it enables are *derived* from it (spaces/templates.ts)
   * rather than copied into the row, so the mapping can gain a tool later
   * without rewriting existing spaces.
   *
   * `slug` is globally unique because `/w/<slug>` has no owner segment. That
   * makes slugs guessable, which is not a disclosure: the route only renders a
   * space to a caller holding a claim grant bound to that `space_id`.
   */
  space_pages: defineTable({
    icon: v.optional(v.string()),
    favorite: v.optional(v.boolean()),
    space_id: v.id("spaces"),
    title: v.string(),
    body: v.string(),
    revision: v.number(),
    created_at: v.number(),
    updated_at: v.number(),
    is_starter: v.boolean(),
  }).index("by_space_id", ["space_id"]),

  spaces: defineTable({
    owner_id: v.id("auth_users"), // NOT NULL: a space cannot be orphaned
    name: v.string(), // 3-50 chars, trimmed, no control/zero-width characters
    slug: v.string(), // globally unique, /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    icon: v.union(
      v.literal("🚀"),
      v.literal("🏠"),
      v.literal("💼"),
      v.literal("🎓"),
      v.literal("🧠"),
      v.literal("⚡"),
      v.literal("📌"),
      v.literal("🎨"),
      v.literal("🩷"),
    ),
    purpose: v.union(
      v.literal("personal"),
      v.literal("work"),
      v.literal("study"),
      v.literal("blank"),
    ),
    is_private: v.boolean(), // always true at creation
    created_at: v.number(),
    deleted_at: v.optional(v.number()), // soft delete
    starter_initialized_at: v.optional(v.number()),
  })
    .index("by_owner_id", ["owner_id"])
    .index("by_slug", ["slug"]),
});
