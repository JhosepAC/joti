// H3 + M5 regression: registration must not disclose which emails or
// usernames are taken, and a retryable profile failure must not burn the
// single-use grant.
import { describe, expect, test } from "vitest";
import {
  api,
  internal,
  registerVerifiedUser,
  testClient,
  TEST_CODE,
  TEST_PASSWORD,
  hashEmailCode,
} from "./helpers";

const GENERIC_MESSAGE =
  "Could not create an account with the provided details.";

async function verifyAddress(t: ReturnType<typeof testClient>, email: string) {
  await t.mutation(internal.auth.verificationInternal.upsertCode, {
    email,
    code_hash: hashEmailCode(TEST_CODE),
    expires_at: Date.now() + 10 * 60 * 1000,
  });
  const result = (await t.action(api.auth.verification.confirmEmailCode, {
    email,
    code: TEST_CODE,
  })) as { claim: string };
  return result.claim;
}

describe("register enumeration", () => {
  test("a recently verified address still requires its own one-use proof", async () => {
    const t = testClient();
    const email = "verified-owner@example.com";
    const claim = await verifyAddress(t, email);
    const payload = {
      email,
      password: TEST_PASSWORD,
      username: "verifiedowner",
      display_name: "Owner",
    };
    await expect(
      t.action(api.auth.actions.register, {
        ...payload,
        claim: "not-the-address-proof",
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("auth_users").collect()),
    ).toHaveLength(0);
    await t.action(api.auth.actions.register, { ...payload, claim });
    await expect(
      t.action(api.auth.actions.register, { ...payload, claim }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("auth_users").collect()),
    ).toHaveLength(1);
  });

  test("expired proof rolls back account and profile creation together", async () => {
    const t = testClient();
    const email = "expired-owner@example.com";
    const claim = await verifyAddress(t, email);
    await t.run(async (ctx) => {
      const grant = await ctx.db.query("auth_claim_grants").first();
      await ctx.db.patch(grant!._id, { expires_at: Date.now() - 1 });
    });
    const { sha256Hex } = await import("./helpers");
    await expect(
      t.mutation(internal.auth.mutations.createUserInternal, {
        email,
        claim_hash: sha256Hex(claim),
        password_hash: "never-written",
        username: "expiredowner",
        display_name: "Owner",
      }),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("auth_users").collect()),
    ).toHaveLength(0);
    expect(
      await t.run((ctx) => ctx.db.query("auth_user_profiles").collect()),
    ).toHaveLength(0);
  });

  test("taken email and taken username fail with the identical generic message", async () => {
    const t = testClient();
    await registerVerifiedUser(t, {
      email: "taken@example.com",
      username: "takenname",
    });

    const takenClaim = await verifyAddress(t, "taken@example.com");
    const emailTaken = await t
      .action(api.auth.actions.register, {
        email: "taken@example.com",
        claim: takenClaim,
        password: TEST_PASSWORD,
        username: "freshnameone",
        display_name: "Probe",
      })
      .then(
        () => "UNEXPECTED_SUCCESS",
        (e: Error) => e.message,
      );

    const probeClaim = await verifyAddress(t, "probe-user@example.com");
    const usernameTaken = await t
      .action(api.auth.actions.register, {
        email: "probe-user@example.com",
        claim: probeClaim,
        password: TEST_PASSWORD,
        username: "takenname",
        display_name: "Probe",
      })
      .then(
        () => "UNEXPECTED_SUCCESS",
        (e: Error) => e.message,
      );

    expect(emailTaken).toContain(GENERIC_MESSAGE);
    expect(usernameTaken).toContain(GENERIC_MESSAGE);
    expect(emailTaken).toBe(usernameTaken);
  });

  test("neither message names the conflicting email or username", async () => {
    const t = testClient();
    await registerVerifiedUser(t, {
      email: "victim@example.com",
      username: "victimname",
    });
    const attackerClaim = await verifyAddress(t, "attacker@example.com");
    const err = await t
      .action(api.auth.actions.register, {
        email: "victim@example.com",
        claim: attackerClaim,
        password: TEST_PASSWORD,
        username: "attackername",
        display_name: "Probe",
      })
      .then(
        () => "UNEXPECTED_SUCCESS",
        (e: Error) => e.message,
      );
    expect(err).not.toContain("victim@example.com");
    expect(err).not.toContain("victimname");
  });
});

describe("completeProfile grant survival (M5)", () => {
  test("a taken username does not burn the grant: retry with a free name succeeds", async () => {
    const t = testClient();
    await registerVerifiedUser(t, {
      email: "owner@example.com",
      username: "ownername",
    });

    const email = "retry@example.com";
    await t.mutation(internal.auth.verificationInternal.upsertCode, {
      email,
      code_hash: hashEmailCode(TEST_CODE),
      expires_at: Date.now() + 10 * 60 * 1000,
    });
    const { claim } = (await t.action(api.auth.verification.confirmEmailCode, {
      email,
      code: TEST_CODE,
    })) as { claim: string };

    // First attempt fails on the taken username...
    await expect(
      t.action(api.auth.actions.completeProfile, {
        email,
        claim,
        username: "ownername",
        display_name: "Retry",
        password: TEST_PASSWORD,
      }),
    ).rejects.toThrow();

    // ...but the SAME grant still works for the retry.
    const result = (await t.action(api.auth.actions.completeProfile, {
      email,
      claim,
      username: "retryname",
      display_name: "Retry",
      password: TEST_PASSWORD,
    })) as { userId: string; claim: string };
    expect(result.userId).toBeDefined();
    expect(result.claim).toBeDefined();
  });
});
