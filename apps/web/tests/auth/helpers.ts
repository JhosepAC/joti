// Shared harness for the auth regression suite.
//
// A fresh in-process backend is built per test file via convex-test, so tests
// never touch the real deployment and never send real email.

import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import { hashEmailCode, sha256Hex } from "../../convex/auth/crypto";

declare global {
  // Minimal shape for the module map below (avoids depending on vite/client types).
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

// Lazy module map of the backend. convex-test requires the glob to cover the
// `_generated` directory (it locates the functions root through it).
// NOTE: test files must live OUTSIDE convex/ (here in tests/): the Convex
// bundler traverses every module reachable from convex/, and a test importing
// a Node-only helper (e.g. auth/crypto -> node:crypto) would make `convex
// dev`/`codegen` try to bundle it for the V8 isolate and fail.
export const modules = import.meta.glob(["../../convex/**/*.ts", "../../convex/**/*.js"]);

export function testClient() {
  return convexTest(schema, modules);
}

export type TestClient = ReturnType<typeof testClient>;

export const TEST_CODE = "123456";
export const TEST_PASSWORD = "Sup3r-S3cret-Pw!";

export interface TestAccount {
  email: string;
  userId: string;
}

/**
 * Builds a fully registered account without touching the network: issues a
 * known code through the internal mutation, redeems it, and completes the
 * profile (which creates the user row). Mirrors the public wizard flow.
 */
export async function registerVerifiedUser(
  t: TestClient,
  opts: { email: string; password?: string; username: string; displayName?: string },
): Promise<TestAccount> {
  const password = opts.password ?? TEST_PASSWORD;
  await t.mutation(internal.auth.verificationInternal.upsertCode, {
    email: opts.email,
    code_hash: hashEmailCode(TEST_CODE),
    expires_at: Date.now() + 10 * 60 * 1000,
  });
  const confirmed = (await t.action(api.auth.verification.confirmEmailCode, {
    email: opts.email,
    code: TEST_CODE,
  })) as { claim: string };
  const created = (await t.action(api.auth.actions.completeProfile, {
    email: opts.email,
    claim: confirmed.claim,
    username: opts.username,
    display_name: opts.displayName ?? opts.username,
    password,
  })) as { userId: string };
  return { email: opts.email, userId: created.userId as string };
}

/** Reads the raw user row for lockout/counter assertions. */
export async function readUserByEmail(t: TestClient, email: string) {
  return (await t.query(internal.auth.queries.getUserByEmail, { email })) as {
    failed_login_attempts: number;
    locked_until?: number;
  } | null;
}

export { api, internal, hashEmailCode, sha256Hex };
