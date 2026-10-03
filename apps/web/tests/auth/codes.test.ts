// H5 regression: verification codes are stored peppered, verify through the
// peppered digest, keep a short grace period for pre-pepper rows, and reject
// wrong codes without leaking which part failed.
import { describe, expect, test } from "vitest";
import {
  api,
  hashEmailCode,
  internal,
  sha256Hex,
  testClient,
  TEST_CODE,
} from "./helpers";
import { hashEmailCode as hashDirect, hashEmailCodeLegacy } from "../../convex/auth/crypto";

async function issue(t: ReturnType<typeof testClient>, email: string) {
  await t.mutation(internal.auth.verificationInternal.upsertCode, {
    email,
    code_hash: hashEmailCode(TEST_CODE),
    expires_at: Date.now() + 10 * 60 * 1000,
  });
}

describe("peppered code digests (H5)", () => {
  test("correct code verifies and returns a claim grant", async () => {
    const t = testClient();
    await issue(t, "peppered@example.com");
    const result = (await t.action(api.auth.verification.confirmEmailCode, {
      email: "peppered@example.com",
      code: TEST_CODE,
    })) as { verified: boolean; claim: string };
    expect(result.verified).toBe(true);
    expect(result.claim).toBeDefined();
  });

  test("stored digest is peppered, not the raw sha256 of the code", async () => {
    const t = testClient();
    await issue(t, "digest@example.com");
    const row = await t.run(async (ctx) => {
      return await ctx.db
        .query("auth_email_verifications")
        .withIndex("by_email", (q) => q.eq("email", "digest@example.com"))
        .first();
    });
    expect(row?.code_hash).toBeDefined();
    expect(row?.code_hash).not.toBe(sha256Hex(TEST_CODE));
    expect(row?.code).toBeUndefined();
  });

  test("wrong code fails generically and burns an attempt", async () => {
    const t = testClient();
    await issue(t, "wrong@example.com");
    await expect(
      t.action(api.auth.verification.confirmEmailCode, {
        email: "wrong@example.com",
        code: "000000",
      }),
    ).rejects.toThrow("Invalid or expired code.");
    const row = await t.run(async (ctx) => {
      return await ctx.db
        .query("auth_email_verifications")
        .withIndex("by_email", (q) => q.eq("email", "wrong@example.com"))
        .first();
    });
    expect(row?.attempts).toBe(1);
  });

  test("pre-pepper rows verify through the grace-period digest", async () => {
    const t = testClient();
    const email = "legacy@example.com";
    await t.run(async (ctx) => {
      await ctx.db.insert("auth_email_verifications", {
        email,
        code_hash: sha256Hex("654321"),
        expires_at: Date.now() + 10 * 60 * 1000,
        attempts: 0,
      });
    });
    const result = (await t.action(api.auth.verification.confirmEmailCode, {
      email,
      code: "654321",
    })) as { verified: boolean };
    expect(result.verified).toBe(true);
  });

  test("hashEmailCode requires the pepper (fail closed)", async () => {
    const saved = process.env.EMAIL_CODE_PEPPER;
    delete process.env.EMAIL_CODE_PEPPER;
    try {
      expect(() => hashDirect("123456")).toThrow(/EMAIL_CODE_PEPPER/);
    } finally {
      process.env.EMAIL_CODE_PEPPER = saved;
    }
    expect(hashEmailCodeLegacy("123456")).toBe(sha256Hex("123456"));
  });
});
