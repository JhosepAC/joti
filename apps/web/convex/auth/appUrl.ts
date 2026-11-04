// Absolute origin of the Next.js app, used to build OAuth and password-reset
// redirect targets.
//
// Fail-closed: guessing `http://localhost:3000` when the variable is absent
// would emit reset links and OAuth redirects pointing at a machine the user
// does not control in production. Set NEXT_PUBLIC_APP_URL on the deployment
// (see convex/README.md prerequisites).
//
// Isolate-safe on purpose (no `node:*` imports): both the V8 `httpAction`
// callback and the Node email/password-reset actions read it from here.

export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const clean = raw.trim().replace(/\/+$/, "");
  if (clean.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. Refusing to build redirect links against a guessed origin.",
    );
  }
  const url = new URL(clean);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "App URL must be an HTTPS origin (HTTP allowed only for local development).",
    );
  }
  return url.origin;
}
