// Low-severity regression suite: atomic grant-bound writes, scheduled
// cleaners, fail-closed configuration, and input validation wiring.
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
import { getAppUrl } from "../../convex/auth/appUrl";
import { validateEmail } from "../../convex/auth/validators";

async function loginClaim(t: ReturnType<typeof testClient>, email: string) {
  const result = (await t.action(api.auth.actions.login, {
    email,
    password: TEST_PASSWORD,
  })) as { claim: string };
  return result.claim;
}

describe("atomic space creation (L9)", () => {
  test("a deleted older space cannot hide an existing active space", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "existing@example.com",
      username: "existinguser",
    });
    await t.run(async (ctx) => {
      const base = {
        owner_id: account.userId as never,
        icon: "🚀" as const,
        purpose: "personal" as const,
        is_private: true,
        created_at: Date.now(),
      };
      await ctx.db.insert("spaces", {
        ...base,
        name: "Archived",
        slug: "archived",
        deleted_at: Date.now(),
      });
      await ctx.db.insert("spaces", {
        ...base,
        name: "Active",
        slug: "active",
      });
    });
    const claim = await loginClaim(t, account.email);
    await expect(
      t.action(api.spaces.actions.createFirstSpace, {
        email: account.email,
        claim,
        name: "Duplicate",
        icon: "🚀",
        purpose: "personal",
      }),
    ).rejects.toThrow("Ya tienes un espacio");
  });

  test("concurrent first-space calls with one grant create exactly one space", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "race@example.com",
      username: "raceuser",
    });
    const claim = await loginClaim(t, account.email);
    const entry = (await t.action(api.spaces.actions.getEntryContext, {
      email: account.email,
      claim,
    })) as { stage: string; claim: string };
    expect(entry.stage).toBe("space");

    const payload = {
      email: account.email,
      claim: entry.claim,
      name: "Race Space",
      icon: "🚀",
      purpose: "personal",
    } as const;
    const [first, second] = await Promise.allSettled([
      t.action(api.spaces.actions.createFirstSpace, { ...payload }),
      t.action(api.spaces.actions.createFirstSpace, { ...payload }),
    ]);
    const succeeded = [first, second].filter((r) => r.status === "fulfilled");
    const failed = [first, second].filter((r) => r.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const spaces = await t.run(async (ctx) => {
      return await ctx.db
        .query("spaces")
        .withIndex("by_owner_id", (q) =>
          q.eq("owner_id", account.userId as never),
        )
        .collect();
    });
    expect(spaces.filter((s) => !s.deleted_at)).toHaveLength(1);
  });

  test("a validation failure does not burn the grant", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "retryable@example.com",
      username: "retryableuser",
    });
    const claim = await loginClaim(t, account.email);
    const entry = (await t.action(api.spaces.actions.getEntryContext, {
      email: account.email,
      claim,
    })) as { stage: string; claim: string };

    // "" fails space-name validation inside the atomic mutation...
    await expect(
      t.action(api.spaces.actions.createFirstSpace, {
        email: account.email,
        claim: entry.claim,
        name: "",
        icon: "🚀",
        purpose: "personal",
      }),
    ).rejects.toThrow();

    // ...and the SAME grant still works for the fixed retry.
    const created = (await t.action(api.spaces.actions.createFirstSpace, {
      email: account.email,
      claim: entry.claim,
      name: "Fixed Name",
      icon: "🚀",
      purpose: "personal",
    })) as { slug: string };
    expect(created.slug).toBeDefined();
  });
});

describe("workspace rotation (L9)", () => {
  test("a rotated-out grant is rejected on replay", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "rotate@example.com",
      username: "rotateuser",
    });
    const claim = await loginClaim(t, account.email);
    const entry = (await t.action(api.spaces.actions.getEntryContext, {
      email: account.email,
      claim,
    })) as { stage: string; claim: string };
    const created = (await t.action(api.spaces.actions.createFirstSpace, {
      email: account.email,
      claim: entry.claim,
      name: "Rotate Space",
      icon: "🏠",
      purpose: "personal",
    })) as { slug: string; spaceGrant: string };

    const first = (await t.action(api.spaces.actions.getWorkspace, {
      slug: created.slug,
      grant: created.spaceGrant,
    })) as { grant: string };
    expect(first.grant).toBeDefined();
    expect(first.grant).not.toBe(created.spaceGrant);

    // The presented grant died with the rotation.
    await expect(
      t.action(api.spaces.actions.getWorkspace, {
        slug: created.slug,
        grant: created.spaceGrant,
      }),
    ).rejects.toThrow();

    // The successor keeps working.
    const second = (await t.action(api.spaces.actions.getWorkspace, {
      slug: created.slug,
      grant: first.grant,
    })) as { space: { slug: string } };
    expect(second.space.slug).toBe(created.slug);
  });

  test("a grant bound to another space cannot read this slug", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "bound@example.com",
      username: "bounduser",
    });
    const claim = await loginClaim(t, account.email);
    const entry = (await t.action(api.spaces.actions.getEntryContext, {
      email: account.email,
      claim,
    })) as { stage: string; claim: string };
    const created = (await t.action(api.spaces.actions.createFirstSpace, {
      email: account.email,
      claim: entry.claim,
      name: "Bound Space",
      icon: "💼",
      purpose: "work",
    })) as { slug: string; spaceGrant: string };

    await expect(
      t.action(api.spaces.actions.getWorkspace, {
        slug: "some-other-slug",
        grant: created.spaceGrant,
      }),
    ).rejects.toThrow("not available");
  });
});

describe("scheduled cleaners (L13)", () => {
  test("deleteExpired removes only dead rows in every table", async () => {
    const t = testClient();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("auth_claim_grants", {
        email: "old@example.com",
        scope: "account",
        token_hash: "dead",
        issued_at: now - 3600_000,
        expires_at: now - 1000,
      });
      await ctx.db.insert("auth_email_verifications", {
        email: "old@example.com",
        code_hash: "dead",
        expires_at: now - 25 * 3600_000,
        attempts: 0,
      });
      await ctx.db.insert("auth_email_verifications", {
        email: "fresh@example.com",
        code_hash: hashEmailCode(TEST_CODE),
        expires_at: now + 600_000,
        attempts: 0,
      });
    });

    // Fresh code still verifies (cleaners must not touch live rows)...
    const before = (await t.action(api.auth.verification.confirmEmailCode, {
      email: "fresh@example.com",
      code: TEST_CODE,
    })) as { verified: boolean };
    expect(before.verified).toBe(true);

    // ...while dead rows are swept. The fresh address redeemed its code above,
    // which minted a live 15-minute grant -- that one must survive.
    const grants = await t.mutation(
      internal.auth.claimGrants.deleteExpired,
      {},
    );
    expect(grants.deleted).toBe(1);
    const codes = await t.mutation(
      internal.auth.verificationInternal.deleteExpired,
      {},
    );
    expect(codes.deleted).toBe(1);
    const remaining = await t.run(async (ctx) => {
      return await ctx.db.query("auth_claim_grants").collect();
    });
    expect(remaining.every((r) => r.expires_at >= Date.now())).toBe(true);
  });
});

describe("fail-closed configuration (L11, L14)", () => {
  test("getAppUrl throws without an origin instead of guessing localhost", async () => {
    const savedApp = process.env.NEXT_PUBLIC_APP_URL;
    const savedSite = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
    } finally {
      if (savedApp !== undefined) process.env.NEXT_PUBLIC_APP_URL = savedApp;
      if (savedSite !== undefined) process.env.NEXT_PUBLIC_SITE_URL = savedSite;
    }
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    try {
      expect(getAppUrl()).toBe("https://example.com");
    } finally {
      if (savedApp !== undefined) process.env.NEXT_PUBLIC_APP_URL = savedApp;
      else delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  test("OAuth state requires its own secret", async () => {
    const { createSignedState } =
      await import("../../convex/auth/_oauthShared");
    const saved = process.env.OAUTH_STATE_SECRET;
    delete process.env.OAUTH_STATE_SECRET;
    try {
      await expect(createSignedState()).rejects.toThrow(/OAUTH_STATE_SECRET/);
    } finally {
      if (saved !== undefined) process.env.OAUTH_STATE_SECRET = saved;
    }
  });
});

describe("input validation wiring (L7, L8)", () => {
  test("confirmEmailCode rejects malformed addresses before any DB work", async () => {
    const t = testClient();
    await expect(
      t.action(api.auth.verification.confirmEmailCode, {
        email: "x".repeat(400),
        code: "123456",
      }),
    ).rejects.toThrow(/exceed 320/);
  });

  test("locale and timezone are clamped, never stored raw", async () => {
    const t = testClient();
    const email = "locale@example.com";
    await t.mutation(internal.auth.verificationInternal.upsertCode, {
      email,
      code_hash: hashEmailCode(TEST_CODE),
      expires_at: Date.now() + 600_000,
    });
    const { claim } = (await t.action(api.auth.verification.confirmEmailCode, {
      email,
      code: TEST_CODE,
    })) as { claim: string };
    await t.action(api.auth.actions.completeProfile, {
      email,
      claim,
      username: "localeuser",
      display_name: "Locale",
      password: "Sup3r-S3cret-Pw!",
      locale: "en-US-extra-long-value",
      timezone:
        "America/Argentina/Buenos_Aires/Extra/Segment/That/Goes/On/Forever/XX",
    });
    const profile = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("auth_users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (!user) return null;
      return await ctx.db
        .query("auth_user_profiles")
        .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
        .first();
    });
    expect(profile?.locale).toBe("en-US-extr");
    expect(profile?.timezone).toHaveLength(64);
  });

  test("validateEmail is the single address gate", () => {
    expect(() => validateEmail("  padded@example.com  ")).not.toThrow();
    expect(validateEmail("  padded@example.com  ")).toBe("padded@example.com");
    expect(() => validateEmail("has space@example.com")).toThrow();
  });
});
