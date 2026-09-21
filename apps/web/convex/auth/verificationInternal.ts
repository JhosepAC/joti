import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const MAX_ATTEMPTS = 5;

export const upsertCode = internalMutation({
  args: { email: v.string(), code: v.string(), expires_at: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        code: args.code,
        expires_at: args.expires_at,
        attempts: 0,
        verified_at: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("auth_email_verifications", {
      email: args.email,
      code: args.code,
      expires_at: args.expires_at,
      attempts: 0,
    });
  },
});

export const verifyCode = internalMutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!record) return { verified: false };
    if (record.expires_at < Date.now()) return { verified: false };
    if (record.attempts >= MAX_ATTEMPTS) {
      throw new ConvexError("Too many attempts. Request a new code.");
    }

    if (record.code !== args.code) {
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      return { verified: false };
    }

    await ctx.db.patch(record._id, { verified_at: Date.now(), attempts: 0 });
    return { verified: true };
  },
});

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auth_email_verifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});
