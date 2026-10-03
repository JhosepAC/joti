import { httpRouter } from "convex/server";
import { googleAuthorize } from "./oauth/google/authorize";
import { googleCallback } from "./oauth/google/callback";

/**
 * HTTP router for the Convex deployment.
 *
 * Without this file, `httpAction`s (the Google OAuth endpoints) are never
 * served, no matter what the frontend redirects to. Every `httpAction` must
 * be mounted here exactly once.
 */

const http = httpRouter();

http.route({
  path: "/oauth/google/authorize",
  method: "GET",
  handler: googleAuthorize,
});

http.route({
  path: "/oauth/google/callback",
  method: "GET",
  handler: googleCallback,
});

export default http;
