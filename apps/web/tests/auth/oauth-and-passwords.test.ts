// Google sign-in is intentionally disabled, including direct HTTP endpoints.
import { describe, expect, test } from "vitest";
import { testClient } from "./helpers";
import { validatePassword } from "../../convex/auth/validators";

describe("disabled external providers", () => {
  test("authorization and callback endpoints are not mounted", async () => {
    const t = testClient();
    for (const path of [
      "/oauth/google/authorize",
      "/oauth/google/callback?code=unused&state=unused",
    ]) {
      const response = await t.fetch(path);
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
    }
  });
});

describe("password byte cap", () => {
  const email = "bytecap@example.com";
  const username = "bytecapuser";
  test("72-byte passwords are accepted", () =>
    expect(() =>
      validatePassword("a".repeat(72), email, username),
    ).not.toThrow());
  test("73-byte passwords are rejected", () =>
    expect(() => validatePassword("a".repeat(73), email, username)).toThrow(
      /72 bytes/,
    ));
  test("multibyte passwords are measured in bytes", () => {
    expect(() =>
      validatePassword("é".repeat(36), email, username),
    ).not.toThrow();
    expect(() => validatePassword("é".repeat(40), email, username)).toThrow(
      /72 bytes/,
    );
  });
  test("short passwords are rejected", () =>
    expect(() => validatePassword("short", email, username)).toThrow(
      /at least 12/,
    ));
});
