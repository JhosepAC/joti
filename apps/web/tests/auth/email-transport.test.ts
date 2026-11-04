import { afterEach, describe, expect, test, vi } from "vitest";
import nodemailer from "nodemailer";
import {
  sendVerificationCodeEmail,
  sendPasswordResetEmail,
} from "../../convex/auth/email";
import { internal, testClient } from "./helpers";
import { getAppUrl } from "../../convex/auth/appUrl";
const ctx = () => ({ runMutation: vi.fn().mockResolvedValue(null) }) as never;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function transport() {
  vi.stubEnv("GMAIL_APP_PASSWORD", "abcd efgh ijkl mnop");
  const sendMail = vi
      .fn()
      .mockResolvedValue({ accepted: ["other@example.com"], rejected: [] }),
    close = vi.fn();
  const create = vi
    .spyOn(nodemailer, "createTransport")
    .mockReturnValue({ sendMail, close } as never);
  return { sendMail, close, create };
}
describe("Gmail transactional mail security", () => {
  test("fails closed without a credential and without connecting", async () => {
    const create = vi.spyOn(nodemailer, "createTransport");
    expect(
      await sendVerificationCodeEmail(ctx(), "other@example.com", "123456"),
    ).toEqual({ delivered: false, reason: "not_configured" });
    expect(create).not.toHaveBeenCalled();
  });
  test("uses fixed sender and encrypted authenticated SMTP, accepting other recipients", async () => {
    const { sendMail, close, create } = transport();
    expect(
      await sendVerificationCodeEmail(ctx(), "other@example.com", "123456"),
    ).toEqual({ delivered: true });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        logger: false,
        debug: false,
        disableFileAccess: true,
        disableUrlAccess: true,
        tls: expect.objectContaining({
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        }),
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: "Joti", address: "jhosepjamil@gmail.com" },
        envelope: { from: "jhosepjamil@gmail.com", to: ["other@example.com"] },
      }),
    );
    expect(close).toHaveBeenCalled();
  });
  test("rejects header injection and recipient lists before SMTP", async () => {
    const { sendMail } = transport();
    for (const to of [
      "a@example.com,b@example.com",
      "a@example.com\r\nBcc: victim@example.com",
      "Name <a@example.com>",
    ])
      expect(
        (await sendVerificationCodeEmail(ctx(), to, "123456")).delivered,
      ).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
  test("does not leak SMTP errors, does not retry and closes the connection", async () => {
    const { sendMail, close } = transport(),
      log = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMail.mockRejectedValue(
      new Error("secret credentials and token 123456"),
    );
    expect(
      await sendVerificationCodeEmail(ctx(), "other@example.com", "123456"),
    ).toEqual({ delivered: false, reason: "transport_error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("123456");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
  });
  test("never reports acceptance for rejected messages", async () => {
    const { sendMail } = transport();
    sendMail.mockResolvedValue({
      accepted: [],
      rejected: ["other@example.com"],
    });
    expect(
      (await sendVerificationCodeEmail(ctx(), "other@example.com", "123456"))
        .delivered,
    ).toBe(false);
  });
  test("rejects foreign reset-link origins", async () => {
    const { sendMail } = transport();
    expect(
      (
        await sendPasswordResetEmail(
          ctx(),
          "other@example.com",
          "https://attacker.example/auth/reset-password?token=secret",
        )
      ).delivered,
    ).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
  test("rejects insecure production app URLs", () => {
    for (const origin of [
      "http://joti.example",
      "https://user:pass@joti.example",
      "https://joti.example/path",
    ]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
      expect(() => getAppUrl()).toThrow();
    }
  });
  test("atomic sender quota bounds parallel sends", async () => {
    const t = testClient();
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        t.mutation(internal.auth.emailQuota.consume, {}),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rows = await t.run((ctx) =>
      ctx.db.query("auth_rate_limits").collect(),
    );
    expect(rows.find((r) => r.key === "gmail:day")?.count).toBe(10);
    await t.run(async (ctx) => {
      for (const r of rows)
        await ctx.db.patch(r._id, {
          window_start: Date.now() - 120000,
          ...(r.key === "gmail:day" ? { count: 200 } : {}),
        });
    });
    await expect(
      t.mutation(internal.auth.emailQuota.consume, {}),
    ).rejects.toThrow("RATE_LIMITED");
  });
  test("failed older sends cannot delete newer verification codes", async () => {
    const t = testClient(),
      email = "race@example.com";
    await t.mutation(internal.auth.verificationInternal.upsertCode, {
      email,
      code_hash: "newer",
      expires_at: Date.now() + 600000,
    });
    await t.mutation(internal.auth.verificationInternal.clearByEmail, {
      email,
      code_hash: "older",
    });
    expect(
      (await t.query(internal.auth.verificationInternal.getByEmail, { email }))
        ?.code_hash,
    ).toBe("newer");
    await expect(
      t.mutation(internal.auth.verificationInternal.upsertCode, {
        email,
        code_hash: "third",
        expires_at: Date.now() + 600000,
        enforceCooldown: true,
      }),
    ).rejects.toThrow("RATE_LIMITED");
  });
});
