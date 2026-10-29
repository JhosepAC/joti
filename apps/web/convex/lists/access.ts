import { internalMutation } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";

export async function digest(raw: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function authorize(ctx: QueryCtx | MutationCtx, token: string) {
  if (token.length < 32 || token.length > 256) return null;
  const hash = await digest(token);
  const access = await ctx.db
    .query("list_access")
    .withIndex("by_token_hash", (q) => q.eq("token_hash", hash))
    .first();
  if (!access || access.expires_at <= Date.now()) return null;
  const session = await ctx.db.get(access.session_id);
  if (
    !session ||
    session.user_id !== access.user_id ||
    session.expires_at <= Date.now()
  )
    return null;
  const user = await ctx.db.get(access.user_id);
  const space = await ctx.db.get(access.space_id);
  if (
    !user ||
    user.deleted_at ||
    !user.email_verified_at ||
    !space ||
    space.deleted_at ||
    space.owner_id !== user._id
  )
    return null;
  return { access, session, user, space };
}

export const mint = internalMutation({
  args: { session_hash: v.string(), ticket_hash: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    const fail = (): never => {
      throw new ConvexError({ code: "UNAUTHORIZED" });
    };
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.session_hash))
      .first();
    if (!session || session.expires_at <= Date.now()) return fail();
    const user = await ctx.db.get(session.user_id);
    if (!user || user.deleted_at || !user.email_verified_at) return fail();
    const space = await ctx.db
      .query("spaces")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!space || space.deleted_at || space.owner_id !== user._id)
      return fail();
    const previous = await ctx.db
      .query("list_access")
      .withIndex("by_session", (q) => q.eq("session_id", session._id))
      .collect();
    for (const ticket of previous)
      if (ticket.expires_at <= Date.now()) await ctx.db.delete(ticket._id);
    const active = previous
      .filter((row) => row.expires_at > Date.now())
      .sort((a, b) => a.expires_at - b.expires_at);
    for (const ticket of active.slice(0, Math.max(0, active.length - 39)))
      await ctx.db.delete(ticket._id);
    const expiresAt = Math.min(Date.now() + 10 * 60 * 1000, session.expires_at);
    await ctx.db.insert("list_access", {
      token_hash: args.ticket_hash,
      session_id: session._id,
      user_id: user._id,
      space_id: space._id,
      expires_at: expiresAt,
    });
    return { expiresAt };
  },
});
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const row of await ctx.db
      .query("list_access")
      .withIndex("by_expires_at", (q) => q.lte("expires_at", Date.now()))
      .take(1000))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db
      .query("list_operations")
      .withIndex("by_created_at", (q) =>
        q.lte("created_at", Date.now() - 7 * 86400000),
      )
      .take(2000))
      await ctx.db.delete(row._id);
  },
});
