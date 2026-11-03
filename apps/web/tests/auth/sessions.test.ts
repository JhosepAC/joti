import nodemailer from "nodemailer";
import { describe, expect, test, vi } from "vitest";
import {
  api,
  internal,
  registerVerifiedUser,
  testClient,
  TEST_PASSWORD,
} from "./helpers";
import { sha256Hex, verifyPassword } from "../../convex/auth/crypto";

async function account() {
  const t = testClient();
  const user = await registerVerifiedUser(t, {
    email: "session-owner@example.com",
    username: "sessionowner",
  });
  const login = (await t.action(api.auth.actions.login, {
    email: user.email,
    password: TEST_PASSWORD,
  })) as { claim: string };
  return { t, user, claim: login.claim };
}

describe("durable account sessions", () => {
  test("creation rotates a proven account grant and stores only token hashes", async () => {
    const { t, user, claim } = await account();
    const session = await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim,
    });
    const rows = await t.run((ctx) => ctx.db.query("auth_sessions").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.token_hash).toBe(sha256Hex(session.token));
    expect(JSON.stringify(rows)).not.toContain(session.token);
    await expect(
      t.query(internal.auth.claimGrants.peek, {
        scope: "account",
        token_hash: sha256Hex(claim),
      }),
    ).rejects.toThrow();
    const proof = await t.query(internal.auth.claimGrants.peek, {
      scope: "account",
      token_hash: sha256Hex(session.claim),
    });
    expect(proof.email).toBe(user.email);
    const resumed = await t.action(api.auth.sessions.resumeSession, {
      token: session.token,
    });
    expect(resumed?.email).toBe(user.email);
    expect(resumed?.claim).not.toBe(session.claim);
  });

  test("a grant cannot create a session for another address or be replayed", async () => {
    const { t, user, claim } = await account();
    await expect(
      t.action(api.auth.sessions.createSession, {
        email: "someone-else@example.com",
        claim,
      }),
    ).rejects.toThrow();
    await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim,
    });
    await expect(
      t.action(api.auth.sessions.createSession, { email: user.email, claim }),
    ).rejects.toThrow();
  });

  test("unknown, expired, revoked and deactivated sessions fail closed", async () => {
    const { t, user, claim } = await account();
    expect(
      await t.action(api.auth.sessions.resumeSession, { token: "bad" }),
    ).toBeNull();
    expect(
      await t.action(api.auth.sessions.resumeSession, {
        token: "x".repeat(64),
      }),
    ).toBeNull();
    const session = await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim,
    });
    await t.action(api.auth.sessions.revokeSession, { token: session.token });
    expect(
      await t.action(api.auth.sessions.resumeSession, { token: session.token }),
    ).toBeNull();
    const login = (await t.action(api.auth.actions.login, {
      email: user.email,
      password: TEST_PASSWORD,
    })) as { claim: string };
    const expiring = await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim: login.claim,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("auth_sessions").first();
      await ctx.db.patch(row!._id, { expires_at: Date.now() - 1 });
    });
    expect(
      await t.action(api.auth.sessions.resumeSession, {
        token: expiring.token,
      }),
    ).toBeNull();
    const nextLogin = (await t.action(api.auth.actions.login, {
      email: user.email,
      password: TEST_PASSWORD,
    })) as { claim: string };
    const deleted = await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim: nextLogin.claim,
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.query("auth_users").first();
      await ctx.db.patch(row!._id, { deleted_at: Date.now() });
    });
    expect(
      await t.action(api.auth.sessions.resumeSession, { token: deleted.token }),
    ).toBeNull();
  });

  test("at most ten devices retain live sessions", async () => {
    const { t, user, claim: initial } = await account();
    let claim = initial;
    let oldest = "";
    for (let i = 0; i < 12; i++) {
      const session = await t.action(api.auth.sessions.createSession, {
        email: user.email,
        claim,
      });
      claim = session.claim;
      if (i === 0) oldest = session.token;
    }
    expect(
      await t.run((ctx) => ctx.db.query("auth_sessions").collect()),
    ).toHaveLength(10);
    expect(
      await t.action(api.auth.sessions.resumeSession, { token: oldest }),
    ).toBeNull();
  });
});

describe("password reset ownership and atomicity", () => {
  test("simultaneous reset submissions commit once and revoke old authorizations", async () => {
    const { t, user, claim } = await account();
    await t.action(api.auth.sessions.createSession, {
      email: user.email,
      claim,
    });
    const token = "test-reset-proof-with-enough-random-characters";
    const row = await t.run((ctx) => ctx.db.query("auth_users").first());
    await t.mutation(internal.auth.passwordResetInternal.createResetToken, {
      email: user.email,
      user_id: row!._id,
      token_hash: sha256Hex(token),
      expires_at: Date.now() + 60000,
    });
    const passwords = ["AnEntirelyNewPassword!47", "AnotherEntirePassword!83"];
    const results = await Promise.allSettled(
      passwords.map((password) =>
        t.action(api.auth.passwordReset.resetPassword, {
          token,
          password,
          confirmPassword: password,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const winner = results.findIndex((result) => result.status === "fulfilled");
    const changed = await t.run((ctx) => ctx.db.get(row!._id));
    expect(
      await verifyPassword(passwords[winner]!, changed!.password_hash!),
    ).toBe(true);
    expect(
      await t.run((ctx) => ctx.db.query("auth_sessions").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query("auth_claim_grants").collect()),
    ).toHaveLength(0);
    expect(
      await t.action(api.auth.passwordReset.verifyResetToken, { token }),
    ).toEqual({ valid: false });
  });

  test("legacy passwordless accounts receive a reset link rather than a disabled provider suggestion", async () => {
    const t = testClient();
    await t.run((ctx) =>
      ctx.db.insert("auth_users", {
        email: "legacy@example.com",
        email_verified_at: Date.now(),
        failed_login_attempts: 0,
      }),
    );
    vi.stubEnv("GMAIL_APP_PASSWORD", "abcdefghijklmnop");
    const send = vi
      .fn()
      .mockResolvedValue({ accepted: ["legacy@example.com"], rejected: [] });
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: send,
      close: vi.fn(),
    } as never);
    try {
      expect(
        await t.action(api.auth.passwordReset.requestPasswordReset, {
          email: "legacy@example.com",
        }),
      ).toEqual({ sent: true });
      const body = JSON.stringify(send.mock.calls[0]?.[0]);
      expect(body).toContain("/auth/reset-password?token=");
      expect(body).not.toContain("Google");
      expect(
        await t.run((ctx) => ctx.db.query("auth_password_resets").collect()),
      ).toHaveLength(1);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
});
