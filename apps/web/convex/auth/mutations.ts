import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import {
  validateAvatar,
  validateBio,
  validateDisplayName,
  validateEmail,
  validateUsername,
} from "./validators";
import { LOCKOUT_DURATION_MS, MAX_FAILED_ATTEMPTS } from "./constants";
import { findGrantByHash, requireUsableGrant } from "./grantStore";

// ──────────────────────────────────────────────────────────
// Internal — atomic user + profile creation (called by public action)
// ──────────────────────────────────────────────────────────

export const createUserInternal = internalMutation({
  args: {
    email: v.string(),
    claim_hash: v.string(),
    password_hash: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    const proof = await findGrantByHash(ctx, args.claim_hash);
    requireUsableGrant(proof, { email: cleanEmail, scope: "account" });
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    // Re-check uniqueness inside mutation (optimistic concurrency safe)
    const existingEmail = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (existingEmail && !existingEmail.deleted_at) {
      // Generic on purpose: this mutation is reachable from the public
      // `register` action, so a distinct message would be an existence oracle.
      throw new ConvexError(
        "Could not create an account with the provided details.",
      );
    }

    const existingUsername = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existingUsername) {
      // Same generic message as above (see the email branch).
      throw new ConvexError(
        "Could not create an account with the provided details.",
      );
    }

    const userId = await ctx.db.insert("auth_users", {
      email: cleanEmail,
      password_hash: args.password_hash,
      email_verified_at: Date.now(),
      failed_login_attempts: 0,
    });

    await ctx.db.insert("auth_user_profiles", {
      user_id: userId,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale ?? "system",
      timezone: args.timezone ?? "system",
    });

    // Clean up verification record after successful registration
    const verification = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (verification) await ctx.db.delete(verification._id);

    await ctx.db.delete(proof._id);
    return { userId };
  },
});

// ──────────────────────────────────────────────────────────
// Pending registration — create inactive user (credentials step creates account)
// ──────────────────────────────────────────────────────────

// createPendingUser was REMOVED.
//
// It inserted an `auth_users` row (with the password) at wizard step 1, before
// the address was proven. That let an unauthenticated attacker pre-register
// somebody else's address and win the race: the victim would receive and enter
// the verification code, which "verified" whichever password happened to be
// stored last -- the attacker's.
//
// Pending accounts have no profile or workspace access until address verification.

export const activateUser = internalMutation({
  args: { email: v.string(), password_hash: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (!user || user.deleted_at) throw new ConvexError("Account not found.");
    if (user.email_verified_at) return { userId: user._id, already: true };
    await ctx.db.patch(user._id, {
      email_verified_at: Date.now(),
      ...(args.password_hash ? { password_hash: args.password_hash } : {}),
    });
    return { userId: user._id, already: false };
  },
});

export const completeProfile = internalMutation({
  args: {
    userId: v.id("auth_users"),
    claim_hash: v.string(),
    password_hash: v.optional(v.string()),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    const user = await ctx.db.get(args.userId);
    if (!user || user.deleted_at) throw new ConvexError("Account not found.");
    const proof = await findGrantByHash(ctx, args.claim_hash);
    requireUsableGrant(proof, { email: user.email, scope: "account" });
    if (!user.email_verified_at)
      throw new ConvexError("Email not verified. Please verify first.");

    const existingProfile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .first();
    if (existingProfile) throw new ConvexError("Profile already completed.");

    const existingUsername = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existingUsername) throw new ConvexError("Username is already taken.");

    const profileId = await ctx.db.insert("auth_user_profiles", {
      user_id: args.userId,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale ?? "system",
      timezone: args.timezone ?? "system",
    });

    // Clean verification record after profile completion
    const verification = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .first();
    if (verification) await ctx.db.delete(verification._id);

    // Address ownership is proven. Use the password chosen by the verified
    // registrant, preventing pre-registration with an attacker-known password.
    if (args.password_hash)
      await ctx.db.patch(user._id, { password_hash: args.password_hash });
    await ctx.db.delete(proof._id);
    return { profileId };
  },
});

// ---------------------------------------------------------------------------
// REMOVED (security):
//   registerUser            -- accepted a caller-supplied password hash, skipped
//                              validatePassword() and the email-verification gate.
//                              `actions.register` is the supported entry point.
//   createPendingUser       -- created the account at wizard step 1, before the
//                              address was proven, which let an attacker
//                              pre-register someone else's address and have the
//                              victim's code confirm the attacker's password.
//   handleFailedLoginPublic -- public mutation, no auth check. Allowed locking
//                              any account out permanently (targeted DoS).
//   handleSuccessfulLoginPublic -- public mutation, no auth check. Allowed
//                              resetting any account's failed-attempt counter,
//                              which completely disabled brute-force lockout.
// The `internalMutation` versions are the only supported path.
// ---------------------------------------------------------------------------

export const handleFailedLogin = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    // Capped: the counter is only a tripwire for arming the lockout, and an
    // unbounded value would keep growing under a sustained attack.
    const newAttempts = Math.min(
      user.failed_login_attempts + 1,
      MAX_FAILED_ATTEMPTS,
    );
    let lockedUntil = user.locked_until;
    const alreadyLocked = lockedUntil !== undefined && lockedUntil > Date.now();
    // Arm the lockout only on the transition into it. Re-arming on every
    // failure while locked would let anyone keep any account locked forever
    // with a trickle of bad guesses; the lockout must expire on its own.
    if (newAttempts >= MAX_FAILED_ATTEMPTS && !alreadyLocked) {
      lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    await ctx.db.patch(args.userId, {
      failed_login_attempts: newAttempts,
      locked_until: lockedUntil,
    });
  },
});

export const handleSuccessfulLogin = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      failed_login_attempts: 0,
      locked_until: undefined,
      last_login_at: Date.now(),
    });
  },
});

// ──────────────────────────────────────────────────────────
// OAuth — upsert Google account, encrypt tokens via action layer
// ──────────────────────────────────────────────────────────

export const upsertOAuthAccount = internalMutation({
  args: {
    user_id: v.id("auth_users"),
    provider: v.union(v.literal("google")),
    provider_account_id: v.string(),
    provider_email: v.optional(v.string()),
    access_token_encrypted: v.optional(v.string()),
    refresh_token_encrypted: v.optional(v.string()),
    token_expires_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auth_oauth_accounts")
      .withIndex("by_provider_and_account", (q) =>
        q
          .eq("provider", args.provider)
          .eq("provider_account_id", args.provider_account_id),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider_email: args.provider_email ?? existing.provider_email,
        access_token_encrypted:
          args.access_token_encrypted ?? existing.access_token_encrypted,
        refresh_token_encrypted:
          args.refresh_token_encrypted ?? existing.refresh_token_encrypted,
        token_expires_at: args.token_expires_at ?? existing.token_expires_at,
      });
      return { oauthAccountId: existing._id, created: false };
    }

    const oauthAccountId = await ctx.db.insert("auth_oauth_accounts", {
      user_id: args.user_id,
      provider: args.provider,
      provider_account_id: args.provider_account_id,
      provider_email: args.provider_email,
      access_token_encrypted: args.access_token_encrypted,
      refresh_token_encrypted: args.refresh_token_encrypted,
      token_expires_at: args.token_expires_at,
    });
    return { oauthAccountId, created: true };
  },
});

// Password reset — update hash and clear lockout
export const updatePasswordInternal = internalMutation({
  args: { userId: v.id("auth_users"), password_hash: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deleted_at) throw new ConvexError("Account not found.");
    await ctx.db.patch(args.userId, {
      password_hash: args.password_hash,
      failed_login_attempts: 0,
      locked_until: undefined,
    });
    return { userId: args.userId };
  },
});

// Soft delete / restore (admin or user-initiated)
export const softDeleteUser = internalMutation({
  args: { userId: v.id("auth_users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { deleted_at: Date.now() });
  },
});

/** Save only the first pending password. Re-registration cannot replace credentials. */
export const createPending = internalMutation({
  args: { email: v.string(), password_hash: v.string() },
  handler: async (ctx, args) => {
    const email = validateEmail(args.email);
    const existing = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return;
    await ctx.db.insert("auth_users", {
      email,
      password_hash: args.password_hash,
      failed_login_attempts: 0,
    });
  },
});
