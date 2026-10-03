import { httpAction } from "../../_generated/server";
import { ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { completeGoogleLogin, verifySignedState } from "../../auth/_oauthShared";
import { validateEmail } from "../../auth/validators";

/**
 * GET /oauth/google/callback
 *
 * Replaces the removed `actions.linkOAuthAccount`. The account is located and
 * written using only values that Google vouched for:
 *
 *   - `state` must carry a valid HMAC, otherwise the request is a forgery.
 *   - `sub` (the provider account id) and the address come from Google's
 *     verified token response, not from the query string.
 *   - Tokens are encrypted with AES-256-GCM before being stored; if
 *     TOKEN_ENCRYPTION_KEY is missing the write fails instead of silently
 *     persisting cleartext.
 *
 * There is no `userId` parameter, so there is nothing for a caller to spoof.
 *
 * No `"use node"`: an `httpAction` always runs in the V8 isolate, which has no
 * `node:crypto`. The AES step therefore crosses into Node through the
 * `tokenVault.encryptOAuthTokens` internal action.
 */
export const googleCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );

  const fail = (reason: string) =>
    Response.redirect(`${appUrl}/auth/login?error=${encodeURIComponent(reason)}`, 302);

  // Global abuse cap for the callback: it performs 2-3 outbound Google
  // fetches plus encryption and writes per hit, so unbounded calls are
  // compute/bandwidth amplification. Per-actor limiting is not available --
  // the httpAction context exposes no client IP -- so this is a shared
  // fixed window sized far above legitimate login traffic. All rejections
  // (including this one) answer identically via `fail`, so the cap reveals
  // nothing.
  try {
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: "oauth-callback-global",
      limit: 120,
      windowMs: 60 * 1000,
    });
  } catch {
    return fail("oauth_failed");
  }

  const oauthError = url.searchParams.get("error");
  if (oauthError) return fail("oauth_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await verifySignedState(state))) return fail("invalid_state");

  let session;
  try {
    session = await completeGoogleLogin(
      code,
      new URL("/oauth/google/callback", new URL(request.url).origin).toString(),
    );
  } catch {
    // Never surface provider internals to the browser.
    return fail("oauth_failed");
  }

  try {
    const cleanEmail = validateEmail(session.email);

    const existing = (await ctx.runQuery(internal.auth.queries.getSafeUserByEmail, {
      email: cleanEmail,
    })) as { _id: Id<"auth_users"> } | null;

    // Linking is intentionally not account creation: a Google-only account would
    // have no username, no profile and no password, and the app has no session
    // layer yet (see the auth README). The caller is told to register by email
    // first, which also gives them a password they can actually use.
    const userId = existing?._id;
    if (!userId) return fail("account_not_found");

    // Encrypt before storing, in Node. Throws when TOKEN_ENCRYPTION_KEY is
    // absent, which is the intended fail-closed behaviour.
    const { accessTokenEncrypted, refreshTokenEncrypted } = await ctx.runAction(
      internal.auth.tokenVault.encryptOAuthTokens,
      { accessToken: session.accessToken, refreshToken: session.refreshToken },
    );

    await ctx.runMutation(internal.auth.mutations.upsertOAuthAccount, {
      user_id: userId,
      provider: "google",
      provider_account_id: session.providerAccountId,
      provider_email: cleanEmail,
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_expires_at: session.expiresAt,
    });

    await ctx.runMutation(internal.auth.mutations.handleSuccessfulLogin, { userId });

    return Response.redirect(`${appUrl}/auth/login?oauth=success`, 302);
  } catch (e) {
    if (e instanceof ConvexError) return fail("account_not_found");
    return fail("oauth_failed");
  }
});
