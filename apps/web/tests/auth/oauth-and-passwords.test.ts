// M8 regression: the OAuth callback is abuse-capped but never leaks, and
// M9 regression: passwords are capped at 72 UTF-8 bytes (bcrypt limit).
import { describe, expect, test } from "vitest";
import { testClient } from "./helpers";
import { validatePassword } from "../../convex/auth/validators";

describe("oauth callback abuse cap (M8)", () => {
  test("every callback outcome is an identical redirect, even past the cap", async () => {
    const t = testClient();
    const locations = new Set<string>();
    // 130 sequential hits: past the 120/min global window.
    for (let i = 0; i < 130; i++) {
      const res = await t.fetch(`/oauth/google/callback?code=garbage-${i}&state=garbage`);
      expect(res.status).toBe(302);
      locations.add(res.headers.get("location") ?? "");
    }
    // All failures funnel to the login page; none 500s or 404s.
    for (const location of locations) {
      expect(location).toContain("/auth/login");
    }
  });

  test("provider-denied logins redirect identically", async () => {
    const t = testClient();
    const res = await t.fetch("/oauth/google/callback?error=access_denied");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/auth/login?error=oauth_denied");
  });
});

describe("password byte cap (M9)", () => {
  const email = "bytecap@example.com";
  const username = "bytecapuser";

  test("72-byte passwords are accepted", () => {
    expect(() => validatePassword("a".repeat(72), email, username)).not.toThrow();
  });

  test("73-byte passwords are rejected", () => {
    expect(() => validatePassword("a".repeat(73), email, username)).toThrow(/72 bytes/);
  });

  test("multibyte passwords are measured in bytes, not chars", () => {
    // "é" is 2 bytes in UTF-8: 36 chars == 72 bytes (accepted)...
    expect(() => validatePassword("é".repeat(36), email, username)).not.toThrow();
    // ...while 40 chars == 80 bytes (rejected).
    expect(() => validatePassword("é".repeat(40), email, username)).toThrow(/72 bytes/);
  });

  test("short passwords are still rejected by length", () => {
    expect(() => validatePassword("short", email, username)).toThrow(/at least 12/);
  });
});
