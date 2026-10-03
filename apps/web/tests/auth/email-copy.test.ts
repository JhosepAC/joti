// Email copy parity: both presentation locales expose the same subjects and
// bodies, unknown locales fall back to Spanish, and no template leaks secrets.
import { describe, expect, test } from "vitest";
import {
  oauthOnlyNoticeCopy,
  passwordChangedCopy,
  passwordResetCopy,
  resolveEmailLocale,
  verificationCopy,
} from "../../convex/auth/emailCopy";

describe("email copy", () => {
  test("unknown or missing locales fall back to Spanish", () => {
    expect(resolveEmailLocale(undefined)).toBe("es");
    expect(resolveEmailLocale("xx")).toBe("es");
    expect(resolveEmailLocale("en")).toBe("en");
    expect(resolveEmailLocale("es")).toBe("es");
  });

  test("verification templates render the code in both locales", () => {
    for (const locale of ["es", "en"] as const) {
      const copy = verificationCopy(locale);
      expect(copy.subject.length).toBeGreaterThan(0);
      expect(copy.htmlBody("123456")).toContain("123456");
      expect(copy.textBody("123456")).toContain("123456");
    }
    expect(verificationCopy("es").subject).not.toBe(verificationCopy("en").subject);
  });

  test("reset templates embed an escaped link in both locales", () => {
    const evil = 'https://x.test/?a="><script>';
    for (const locale of ["es", "en"] as const) {
      const copy = passwordResetCopy(locale);
      const html = copy.htmlBody("a@b.co", evil);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&quot;");
      expect(copy.textBody("a@b.co", evil)).toContain(evil);
    }
  });

  test("notice templates exist in both locales", () => {
    for (const locale of ["es", "en"] as const) {
      expect(passwordChangedCopy(locale).subject.length).toBeGreaterThan(0);
      expect(oauthOnlyNoticeCopy(locale).subject.length).toBeGreaterThan(0);
    }
  });
});
