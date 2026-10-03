import { ConvexError } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { CLAIM_GRANT_EXPIRY_MS } from "./constants";

// ---------------------------------------------------------------------------
// Single home for claim-grant storage policy.
//
// Several modules need grant checks: `claimGrants` (issue/peek/consume),
// `spaces/mutations` (atomic grant-bound writes) and `auth/storageInternal`
// (read-only grant check for avatar uploads). Reimplementing the lookup in
// each of them is how policy drifts (one copy forgetting the scope check, or
// the expiry handling). Everything grant-related below goes through these
// plain helpers -- plain functions, not Convex functions, so they add no API
// surface and run in whichever runtime imports them (both runtimes can read
// the database; only mutations write).
//
// Two usage shapes:
//   * read-only (queries, peek-style checks): findGrantByHash + requireUsableGrant
//   * single-transaction writes (mutations): the same lookups plus burnGrant /
//     supersedeGrants / insertGrant, so check-and-burn is atomic and a
//     validation failure rolls everything -- including the burn -- back.
// ---------------------------------------------------------------------------

export const SESSION_INVALID = "This session is no longer valid. Please sign in again.";
export const SESSION_EXPIRED = "This session expired. Please sign in again.";

export type GrantDoc = DataModel["auth_claim_grants"]["document"];

type ReadCtx = GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>;
type WriteCtx = GenericMutationCtx<DataModel>;

function invalid(message: string): never {
  throw new ConvexError({ code: "VALIDATION_ERROR", message });
}

/** Lookup by digest. Returns null when unknown -- the caller decides the error. */
export async function findGrantByHash(
  ctx: ReadCtx,
  token_hash: string,
): Promise<GrantDoc | null> {
  return await ctx.db
    .query("auth_claim_grants")
    .withIndex("by_token_hash", (q) => q.eq("token_hash", token_hash))
    .first();
}

/**
 * Validates a grant without writing anything: unknown token, wrong scope,
 * wrong address, wrong space binding, or expiry all throw. Expiry deliberately
 * does NOT delete here -- deletion is a write, and queries must stay
 * read-only; mutating callers delete explicitly after this check.
 *
 * Assertion signature, so `grant` narrows to non-null afterwards.
 */
export function requireUsableGrant(
  grant: GrantDoc | null,
  opts: { email?: string; scope: string; spaceId?: Id<"spaces"> | null },
): asserts grant is GrantDoc {
  if (!grant || grant.scope !== opts.scope) invalid(SESSION_INVALID);
  if (opts.email !== undefined && grant.email !== opts.email) invalid(SESSION_INVALID);
  if (opts.spaceId !== undefined && opts.spaceId !== null && grant.space_id !== opts.spaceId) {
    invalid(SESSION_INVALID);
  }
  if (grant.expires_at < Date.now()) invalid(SESSION_EXPIRED);
}

/** Deletes one grant row. */
export async function burnGrant(ctx: WriteCtx, id: GrantDoc["_id"]): Promise<void> {
  await ctx.db.delete(id);
}

/**
 * Rotation invariant: one live grant per (scope, subject). Deletes every row
 * for the pair so a newly issued grant always supersedes the previous one,
 * which also keeps the table bounded.
 */
export async function supersedeGrants(
  ctx: WriteCtx,
  opts: { scope: string; email: string },
): Promise<void> {
  const superseded = await ctx.db
    .query("auth_claim_grants")
    .withIndex("by_scope_and_email", (q) => q.eq("scope", opts.scope).eq("email", opts.email))
    .collect();
  for (const row of superseded) await ctx.db.delete(row._id);
}

/** Inserts a grant row with the standard lifetime. Returns the expiry. */
export async function insertGrant(
  ctx: WriteCtx,
  opts: {
    email: string;
    user_id?: Id<"auth_users">;
    space_id?: Id<"spaces">;
    scope: string;
    token_hash: string;
  },
): Promise<{ expiresAt: number }> {
  const now = Date.now();
  const expiresAt = now + CLAIM_GRANT_EXPIRY_MS;
  await ctx.db.insert("auth_claim_grants", {
    token_hash: opts.token_hash,
    email: opts.email,
    user_id: opts.user_id,
    scope: opts.scope,
    space_id: opts.space_id,
    issued_at: now,
    expires_at: expiresAt,
  });
  return { expiresAt };
}
