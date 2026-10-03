// M3 + entry-gate regression: grants are single-use and scoped, logout burns
// what is presented while always answering identically.
import { describe, expect, test } from "vitest";
import { api, internal, registerVerifiedUser, sha256Hex, testClient, TEST_PASSWORD } from "./helpers";

describe("grant rotation", () => {
  test("an entry-context claim cannot be replayed", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "replay@example.com",
      username: "replayuser",
    });
    const { claim } = (await t.action(api.auth.actions.login, {
      email: account.email,
      password: TEST_PASSWORD,
    })) as { claim: string };

    // First use decides the stage (profile exists, no space -> "space").
    const first = (await t.action(api.spaces.actions.getEntryContext, {
      email: account.email,
      claim,
    })) as { stage: string; claim: string };
    expect(first.stage).toBe("space");

    // Replaying the consumed grant fails.
    await expect(
      t.action(api.spaces.actions.getEntryContext, { email: account.email, claim }),
    ).rejects.toThrow();
  });

  test("a grant for another address is rejected", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "owner@example.com",
      username: "grantowner",
    });
    const { claim } = (await t.action(api.auth.actions.login, {
      email: account.email,
      password: TEST_PASSWORD,
    })) as { claim: string };
    await expect(
      t.action(api.spaces.actions.getEntryContext, { email: "someone-else@example.com", claim }),
    ).rejects.toThrow();
  });
});

describe("logout (M3)", () => {
  test("logout burns the presented grant and always answers identically", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "signout@example.com",
      username: "signoutuser",
    });
    const { claim } = (await t.action(api.auth.actions.login, {
      email: account.email,
      password: TEST_PASSWORD,
    })) as { claim: string };

    const ok = await t.action(api.auth.actions.logout, {
      email: account.email,
      claim,
    });
    expect(ok).toEqual({ signedOut: true });

    // The burned grant no longer authorizes anything.
    await expect(
      t.action(api.spaces.actions.getEntryContext, { email: account.email, claim }),
    ).rejects.toThrow();

    // Garbage in, same answer out: the response reveals nothing.
    const garbage = await t.action(api.auth.actions.logout, {
      email: "nobody@example.com",
      claim: "not-a-real-grant",
    });
    expect(garbage).toEqual({ signedOut: true });
  });

  test("logout with no grants still answers identically", async () => {
    const t = testClient();
    const empty = await t.action(api.auth.actions.logout, {});
    expect(empty).toEqual({ signedOut: true });
  });

  test("an account grant is rejected where a space grant is required", async () => {
    const t = testClient();
    const account = await registerVerifiedUser(t, {
      email: "scope@example.com",
      username: "scopeuser",
    });
    const { claim } = (await t.action(api.auth.actions.login, {
      email: account.email,
      password: TEST_PASSWORD,
    })) as { claim: string };
    // Same digest, wrong scope: must fail even though the token exists.
    await expect(
      t.query(internal.auth.claimGrants.peek, {
        token_hash: sha256Hex(claim),
        scope: "space",
      }),
    ).rejects.toThrow();
  });
});
