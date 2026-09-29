"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { equalizePasswordTiming, hashPassword, issueClaimGrant, sha256Hex, verifyPassword } from "./crypto";
import { issueVerificationCode } from "./_codeService";
import {
  validateBio,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
  validateAvatar,
} from "./validators";
import {
  CLAIM_SCOPE_ACCOUNT,
  LOGIN_MAX_ATTEMPTS_PER_HOUR,
  VERIFICATION_RECENT_MS,
} from "./constants";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Mints a replacement `account` grant for the step that follows the one that
 * just consumed the old one. Rotation rather than sharing is what stops a
 * captured token from being replayed against a later step.
 */
async function issueAccountGrant(
  ctx: GenericActionCtx<DataModel>,
  email: string,
  userId: Id<"auth_users">,
): Promise<string> {
  const claim = issueClaimGrant();
  await ctx.runMutation(internal.auth.claimGrants.issue, {
    email,
    user_id: userId,
    scope: CLAIM_SCOPE_ACCOUNT,
    token_hash: sha256Hex(claim),
  });
  return claim;
}

type UserRow = {
  _id: Id<"auth_users">;
  email: string;
  password_hash?: string;
  email_verified_at?: number;
  failed_login_attempts: number;
  locked_until?: number;
  deleted_at?: number;
} | null;

/**
 * Requires a recent successful email verification, which is what proves the
 * caller controls the address. Returns nothing.
 */
async function assertRecentlyVerified(
  ctx: GenericActionCtx<DataModel>,
  email: string,
): Promise<void> {
  const record = (await ctx.runQuery(internal.auth.verificationInternal.getByEmail, {
    email,
  })) as { verified_at?: number; expires_at: number } | null;

  if (!record?.verified_at) {
    throw new ConvexError({
      code: "EMAIL_NOT_VERIFIED",
      message: "Email not verified. Please enter the code we emailed you.",
    });
  }
  if (Date.now() - record.verified_at > VERIFICATION_RECENT_MS) {
    throw new ConvexError({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verification expired. Please request a new code.",
    });
  }
}

// ---------------------------------------------------------------------------
// register -- single action: verify address -> hash -> create user + profile
// ---------------------------------------------------------------------------

export const register: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    password: v.string(),
    username: v.string(),
    display_name: v.string(),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"auth_users"> }> => {
    const cleanEmail = validateEmail(args.email);
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    validatePassword(args.password, cleanEmail, cleanUsername);
    await assertRecentlyVerified(ctx, cleanEmail);

    const emailAvailable = (await ctx.runQuery(
      internal.auth.queries.isEmailAvailable,
      { email: cleanEmail },
    )) as boolean;
    if (!emailAvailable) {
      throw new ConvexError("That email address cannot be registered.");
    }

    const usernameAvailable = (await ctx.runQuery(
      internal.auth.queries.isUsernameAvailable,
      { username: cleanUsername },
    )) as boolean;
    if (!usernameAvailable) {
      throw new ConvexError("Username is already taken.");
    }

    // Rate limit before the expensive bcrypt call.
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `register:${cleanEmail}`,
      limit: 5,
      windowMs: HOUR_MS,
    });

    const passwordHash = await hashPassword(args.password);

    return await ctx.runMutation(internal.auth.mutations.createUserInternal, {
      email: cleanEmail,
      password_hash: passwordHash,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale,
      timezone: args.timezone,
    });
  },
});

// ---------------------------------------------------------------------------
// registerPending -- wizard step 1: request a verification code.
//
// It deliberately does NOT persist a password. The previous implementation
// created the account here, which let an attacker pre-register someone else's
// address and have the victim's code confirm the attacker's password. The
// password is now committed only after the address is proven, by `register` or
// `completeProfile`.
// ---------------------------------------------------------------------------

export const registerPending = action({
  args: { email: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cleanEmail = validateEmail(args.email);
    if (args.password !== undefined) {
      // Validate now for fast client-side feedback; never store it.
      validatePassword(args.password, cleanEmail);
    }

    // `_codeService.issueVerificationCode` owns generation, throttling, hashing
    // and delivery, so there is exactly one send path (and one place where
    // secrets stay out of the logs). It enforces the per-address cooldown and
    // hourly cap before doing any work, and no password is ever persisted here.
    const { expiresAt } = await issueVerificationCode(ctx, cleanEmail);

    // Uniform response shape. Deliberately no `alreadyRegistered` flag: that
    // would be a free account-existence oracle for unauthenticated callers.
    return { sent: true, expiresAt };
  },
});

// ---------------------------------------------------------------------------
// completeProfile -- wizard step 4, and the post-login profile gate.
//
// Handles both cases:
//   * no account yet  -> require `password` and create user + profile atomically
//   * account exists  -> require it to be verified, then add the profile only
// ---------------------------------------------------------------------------

export const completeProfile: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    claim: v.string(),
    username: v.string(),
    display_name: v.string(),
    password: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatar: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const cleanEmail = validateEmail(args.email);
    const cleanUsername = validateUsername(args.username);
    const cleanDisplayName = validateDisplayName(args.display_name);
    const cleanBio = validateBio(args.bio);
    const cleanAvatar = validateAvatar(args.avatar);

    const existing = (await ctx.runQuery(internal.auth.queries.getSafeUserByEmail, {
      email: cleanEmail,
    })) as UserRow;

    // Proof of address control. The grant is only ever minted after a
    // successful code redemption (wizard) or a successful password check
    // (post-login), and it is burned here. Without it, knowing a verified
    // address was enough to claim that account's profile.
    await ctx.runMutation(internal.auth.claimGrants.consume, {
      email: cleanEmail,
      scope: CLAIM_SCOPE_ACCOUNT,
      token_hash: sha256Hex(args.claim),
    });

    if (!existing) {
      // No account: this is the tail of registration, so the caller supplies the
      // password that was collected back in step 1.
      if (!args.password) {
        throw new ConvexError({
          code: "VALIDATION_ERROR",
          message: "Password is required to finish creating your account.",
        });
      }
      validatePassword(args.password, cleanEmail, cleanUsername);

      const usernameAvailable = (await ctx.runQuery(
        internal.auth.queries.isUsernameAvailable,
        { username: cleanUsername },
      )) as boolean;
      if (!usernameAvailable) {
        throw new ConvexError("Username is already taken.");
      }

      await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
        key: `complete-profile:${cleanEmail}`,
        limit: 5,
        windowMs: HOUR_MS,
      });

      const passwordHash = await hashPassword(args.password);
      const created = (await ctx.runMutation(
        internal.auth.mutations.createUserInternal,
        {
          email: cleanEmail,
          password_hash: passwordHash,
          username: cleanUsername,
          display_name: cleanDisplayName,
          bio: cleanBio,
          avatar: cleanAvatar,
          locale: args.locale,
          timezone: args.timezone,
        },
      )) as { userId: Id<"auth_users"> };

      // The onboarding continues with the first space, so hand the caller a
      // grant for that step rather than making them sign in again.
      return {
        ...created,
        claim: await issueAccountGrant(ctx, cleanEmail, created.userId),
      };
    }

    // Account already exists: the caller proved they own it (password check
    // issued the grant), so the password is not part of this step.
    if (!existing.email_verified_at) {
      throw new ConvexError({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before completing your profile.",
      });
    }

    const result = (await ctx.runMutation(internal.auth.mutations.completeProfile, {
      userId: existing._id,
      username: cleanUsername,
      display_name: cleanDisplayName,
      bio: cleanBio,
      avatar: cleanAvatar,
      locale: args.locale,
      timezone: args.timezone,
    })) as { profileId: Id<"auth_user_profiles"> };

    return {
      ...result,
      claim: await issueAccountGrant(ctx, cleanEmail, existing._id),
    };
  },
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

export const login: ReturnType<typeof action> = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const cleanEmail = validateEmail(args.email);

    if (!args.password || args.password.length === 0) {
      throw new ConvexError("Password is required.");
    }

    // Bound login attempts per address on top of the per-account lockout, so a
    // distributed attacker cannot grind through a password list.
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `login:${cleanEmail}`,
      limit: LOGIN_MAX_ATTEMPTS_PER_HOUR,
      windowMs: HOUR_MS,
    });

    const user = (await ctx.runQuery(internal.auth.queries.getUserByEmail, {
      email: cleanEmail,
    })) as UserRow;

    // One generic message for every failure mode: missing account, wrong
    // password, deactivated account.
    const invalidCredentials = new ConvexError("Invalid email or password.");

    if (!user) {
      // Equalize timing so response time does not reveal whether the address
      // is registered.
      await equalizePasswordTiming(args.password);
      throw invalidCredentials;
    }

    if (!user.password_hash) {
      // Equalize timing before reporting: this branch used to reveal that an
      // OAuth-only account exists for a given address.
      await equalizePasswordTiming(args.password);
      throw new ConvexError("This account uses Google sign-in. Please continue with Google.");
    }

    // Verify the password BEFORE reporting any account state. The
    // "not verified" / "locked" branches used to run ahead of the comparison,
    // which made them an existence oracle for unauthenticated callers.
    const isValid = await verifyPassword(args.password, user.password_hash);

    if (!isValid) {
      await ctx.runMutation(internal.auth.mutations.handleFailedLogin, {
        userId: user._id,
      });
      throw invalidCredentials;
    }

    // Past this point the caller has proven they own the account, so these
    // messages are safe to surface.
    if (!user.email_verified_at) {
      throw new ConvexError({
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before signing in. Check your inbox for the code.",
      });
    }

    if (user.locked_until && user.locked_until > Date.now()) {
      const secondsLeft = Math.ceil((user.locked_until - Date.now()) / 1000);
      throw new ConvexError(`Account is locked. Try again in ${secondsLeft} seconds.`);
    }

    await ctx.runMutation(internal.auth.mutations.handleSuccessfulLogin, {
      userId: user._id,
    });

    // The password check is proof of ownership, so mint the claim grant the
    // post-login gate needs. This is NOT a session -- it is short-lived,
    // single-use and scoped to finishing onboarding.
    const claim = await issueAccountGrant(ctx, user.email, user._id);

    const profile = await ctx.runQuery(internal.auth.queries.getProfileByUserId, {
      userId: user._id,
    });

    return {
      user: { _id: user._id, email: user.email },
      profile,
      claim,
    };
  },
});

// linkOAuthAccount was REMOVED.
//
// It was a public action with no authentication that accepted an arbitrary
// userId plus a caller-supplied providerAccountId, so anyone could attach an
// OAuth identity to somebody else's account. It also stored access/refresh
// tokens in cleartext despite the column being named `*_encrypted`.
//
// The replacement is auth/oauth.ts, whose httpActions derive every value from
// Google's own verified token response instead of trusting the caller.
