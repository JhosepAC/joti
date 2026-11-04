import { describe, test, expect } from "vitest";
import {
  api,
  internal,
  testClient,
  hashEmailCode,
  TEST_PASSWORD,
  TEST_CODE,
} from "./helpers";
describe("resumable pending registration", () => {
  test("persists pending account, requires correct password and code, then resumes profile", async () => {
    const t = testClient(),
      email = "pending@example.com";
    await expect(
      t.action(api.auth.actions.registerPending, {
        email,
        password: TEST_PASSWORD,
      }),
    ).rejects.toThrow("EMAIL_DELIVERY_FAILED");
    const user = await t.query(internal.auth.queries.getUserByEmail, { email });
    expect(user?.password_hash).not.toBe(TEST_PASSWORD);
    expect(user?.email_verified_at).toBeUndefined();
    await expect(
      t.action(api.auth.actions.login, { email, password: "Wrong-password!" }),
    ).rejects.toThrow("Invalid email or password");
    await expect(
      t.action(api.auth.actions.login, { email, password: TEST_PASSWORD }),
    ).rejects.toThrow("EMAIL_NOT_VERIFIED");
    const otherPassword = "Another-Secure-Pass!";
    await expect(
      t.action(api.auth.actions.registerPending, {
        email,
        password: otherPassword,
      }),
    ).rejects.toThrow();
    await expect(
      t.action(api.auth.actions.login, { email, password: otherPassword }),
    ).rejects.toThrow("Invalid email or password");
    await t.mutation(internal.auth.verificationInternal.upsertCode, {
      email,
      code_hash: hashEmailCode(TEST_CODE),
      expires_at: Date.now() + 600000,
    });
    await t.action(api.auth.verification.confirmEmailCode, {
      email,
      code: TEST_CODE,
      password: otherPassword,
    });
    await expect(
      t.action(api.auth.actions.login, { email, password: TEST_PASSWORD }),
    ).rejects.toThrow("Invalid email or password");
    const login = (await t.action(api.auth.actions.login, {
      email,
      password: otherPassword,
    })) as { claim: string };
    expect(login.claim).toBeTruthy();
    await t.action(api.auth.actions.completeProfile, {
      email,
      claim: login.claim,
      username: "pendingowner",
      display_name: "Pending owner",
    });
    const profiles = await t.run((ctx) =>
      ctx.db.query("auth_user_profiles").collect(),
    );
    expect(profiles).toHaveLength(1);
  });
  test("email-only requests do not create passwordless accounts", async () => {
    const t = testClient(),
      email = "emailonly@example.com";
    await expect(
      t.action(api.auth.actions.registerPending, { email }),
    ).rejects.toThrow();
    expect(
      await t.query(internal.auth.queries.getUserByEmail, { email }),
    ).toBeNull();
  });
});
