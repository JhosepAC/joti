// H6 + M7 regression: the lockout expires on its own even under attack,
// locked attempts are indistinguishable, and OAuth-only accounts answer like
// any other bad login.
import { describe, expect, test, vi } from "vitest";
import { api, readUserByEmail, registerVerifiedUser, testClient } from "./helpers";

const WRONG = "Wrong-Password-000!";
const RIGHT = "Sup3r-S3cret-Pw!";
const GENERIC = "Invalid email or password.";

async function login(t: ReturnType<typeof testClient>, email: string, password: string) {
  return t.action(api.auth.actions.login, { email, password });
}

describe("lockout (H6)", () => {
  test("five failures arm the lockout; the sixth (correct) password is answered generically", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "locked@example.com",
      username: "lockeduser",
    });

    for (let i = 0; i < 5; i++) {
      await expect(login(t, account.email, WRONG)).rejects.toThrow(GENERIC);
    }
    const armed = await readUserByEmail(t, account.email);
    expect(armed?.locked_until).toBeGreaterThan(Date.now());

    const err = await login(t, account.email, RIGHT).then(
      () => "UNEXPECTED_SUCCESS",
      (e: Error) => e,
    );
    expect((err as Error).message).toContain(GENERIC);
    expect((err as Error).message.toLowerCase()).not.toContain("lock");
  });

  test("further failures neither extend the lockout nor grow the counter", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "pinned@example.com",
      username: "pinneduser",
    });

    for (let i = 0; i < 5; i++) {
      await login(t, account.email, WRONG).then(
        () => undefined,
        () => undefined,
      );
    }
    const first = await readUserByEmail(t, account.email);
    for (let i = 0; i < 3; i++) {
      await login(t, account.email, WRONG).then(
        () => undefined,
        () => undefined,
      );
    }
    const second = await readUserByEmail(t, account.email);
    expect(second?.locked_until).toBe(first?.locked_until);
    expect(second?.failed_login_attempts).toBeLessThanOrEqual(5);
  });

  test("after expiry the correct password succeeds and resets the counters", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "expiry@example.com",
      username: "expiryuser",
    });
    for (let i = 0; i < 5; i++) {
      await login(t, account.email, WRONG).then(
        () => undefined,
        () => undefined,
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 16 * 60 * 1000);
      const result = (await login(t, account.email, RIGHT)) as { claim: string };
      expect(result.claim).toBeDefined();
    } finally {
      vi.useRealTimers();
    }

    const after = await readUserByEmail(t, account.email);
    expect(after?.failed_login_attempts).toBe(0);
    expect(after?.locked_until).toBeUndefined();
  });
});

describe("oauth-only accounts (M7)", () => {
  test("any password gets the same generic message, with no provider hint", async () => {
    const t = testClient();
    await t.run(async (ctx) => {
      await ctx.db.insert("auth_users", {
        email: "googleonly@example.com",
        failed_login_attempts: 0,
      });
    });
    const err = await login(t, "googleonly@example.com", "whatever-password-1").then(
      () => "UNEXPECTED_SUCCESS",
      (e: Error) => e,
    );
    expect((err as Error).message).toContain(GENERIC);
    expect((err as Error).message.toLowerCase()).not.toContain("google");
  });
});
