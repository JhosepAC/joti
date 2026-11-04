// H4 + M6 regression: reset requests behave identically for unknown
// addresses, including when the delivery provider fails.
import { describe, expect, test } from "vitest";
import {
  api,
  readUserByEmail,
  registerVerifiedUser,
  testClient,
} from "./helpers";

const THROTTLE_MESSAGE = "Too many reset requests. Please try again later.";

describe("reset request uniformity (H4)", () => {
  test("unknown address: first call succeeds, immediate retry is throttled like a known one", async () => {
    const t = testClient();
    const first = await t.action(api.auth.passwordReset.requestPasswordReset, {
      email: "nobody-here@example.com",
    });
    expect(first).toEqual({ sent: true });

    const err = await t
      .action(api.auth.passwordReset.requestPasswordReset, {
        email: "nobody-here@example.com",
      })
      .then(
        () => "UNEXPECTED_SUCCESS",
        (e: Error) => e,
      );
    expect(err).toBeInstanceOf(Error);
    expect((err as Error & { data?: { code?: string } }).data?.code).toBe(
      "RATE_LIMITED",
    );
    expect((err as Error).message).toContain(THROTTLE_MESSAGE);
  });

  test("unknown address creates no reset rows", async () => {
    const t = testClient();
    await t.action(api.auth.passwordReset.requestPasswordReset, {
      email: "ghost@example.com",
    });
    const rows = await t.run(async (ctx) => {
      return await ctx.db
        .query("auth_password_resets")
        .withIndex("by_email", (q) => q.eq("email", "ghost@example.com"))
        .collect();
    });
    expect(rows).toHaveLength(0);
  });
});

describe("delivery failure (M6)", () => {
  test("verification issuance throws instead of reporting success when the provider is down", async () => {
    // setup.ts unsets GMAIL_APP_PASSWORD, so sendEmail fails closed before any fetch.
    const t = testClient();
    const err = await t
      .action(api.auth.verification.requestEmailCode, {
        email: "undelivered@example.com",
      })
      .then(
        () => "UNEXPECTED_SUCCESS",
        (e: Error) => e,
      );
    expect((err as Error & { data?: { code?: string } }).data?.code).toBe(
      "EMAIL_DELIVERY_FAILED",
    );
  });

  test("failed send leaves no verification row behind", async () => {
    const t = testClient();
    await t
      .action(api.auth.verification.requestEmailCode, {
        email: "rolledback@example.com",
      })
      .then(
        () => undefined,
        () => undefined,
      );
    const row = await t.run(async (ctx) => {
      return await ctx.db
        .query("auth_email_verifications")
        .withIndex("by_email", (q) => q.eq("email", "rolledback@example.com"))
        .first();
    });
    expect(row).toBeNull();
  });

  test("reset delivery failures do not expose account existence or leave a usable token", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "owner@example.com",
      username: "ownername",
    });
    expect(await readUserByEmail(t, account.email)).not.toBeNull();
    expect(
      await t.action(api.auth.passwordReset.requestPasswordReset, {
        email: account.email,
      }),
    ).toEqual({ sent: true });
    expect(
      await t.run((ctx) => ctx.db.query("auth_password_resets").collect()),
    ).toHaveLength(0);
  });
});
