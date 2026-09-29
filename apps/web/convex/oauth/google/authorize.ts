import { httpAction } from "../../_generated/server";
import { buildGoogleAuthorizeUrl, createSignedState } from "../../auth/_oauthShared";

/**
 * GET /oauth/google/authorize
 *
 * Redirects the browser to Google's consent screen with a signed, single-use
 * `state` value so the callback can reject cross-site request forgery.
 *
 * No `"use node"`: an `httpAction` always runs in the V8 isolate, and a Node
 * file may only contain actions. The state helpers it depends on use Web Crypto
 * for exactly that reason.
 */
export const googleAuthorize = httpAction(async (ctx, request) => {
  // The request URL origin is this deployment's site URL.
  const siteUrl = new URL(request.url).origin;
  const redirectUri = new URL("/oauth/google/callback", siteUrl).toString();

  // Optional "return to" path, constrained to same-site relative paths only.
  const requested = new URL(request.url).searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const state = await createSignedState();

  const response = Response.redirect(buildGoogleAuthorizeUrl(redirectUri, state), 302);
  response.headers.append(
    "Set-Cookie",
    `joti_oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  return response;
});
