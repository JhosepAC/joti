"use node";
import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal, api } from "../_generated/api";
import { sha256Hex } from "../auth/crypto";
export const operate = action({
  args: {
    token: v.string(),
    operation: v.union(
      v.literal("load"),
      v.literal("save"),
      v.literal("revoke"),
      v.literal("revokeOthers"),
      v.literal("removeAvatar"),
      v.literal("resetPassword"),
    ),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    locale: v.optional(v.string()),
    sessionId: v.optional(v.id("auth_sessions")),
  },
  handler: async (ctx, { token, ...args }): Promise<unknown> => {
    const data = await ctx.runMutation(internal.account.store.operate, {
      ...args,
      hash: sha256Hex(token),
    });
    if (args.operation === "resetPassword")
      await ctx.runAction(api.auth.passwordReset.requestPasswordReset, {
        email: data.email,
        locale: data.locale === "en" ? "en" : "es",
      });
    return data;
  },
});
export const upload = action({
  args: { token: v.string(), bytes: v.bytes() },
  handler: async (ctx, args): Promise<unknown> => {
    const hash = sha256Hex(args.token);
    const data = await ctx.runMutation(internal.account.store.operate, {
      hash,
      operation: "load",
    });
    const bytes = new Uint8Array(args.bytes);
    if (bytes.length > 512 * 1024 || bytes.length < 12)
      throw new ConvexError({ code: "INVALID_IMAGE" });
    const starts = (values: number[]) =>
      values.every((value, i) => bytes[i] === value);
    const type = starts([137, 80, 78, 71, 13, 10, 26, 10])
      ? "image/png"
      : starts([255, 216, 255])
        ? "image/jpeg"
        : starts([82, 73, 70, 70]) &&
            [87, 69, 66, 80].every((x, i) => bytes[i + 8] === x)
          ? "image/webp"
          : null;
    if (!type) throw new ConvexError({ code: "INVALID_IMAGE" });
    await ctx.runMutation(internal.auth.rateLimit.consumeRateLimit, {
      key: `settings-avatar:${data.email}`,
      limit: 10,
      windowMs: 3600000,
    });
    const id = await ctx.storage.store(new Blob([args.bytes], { type }));
    try {
      return await ctx.runMutation(internal.account.store.operate, {
        hash,
        operation: "avatar",
        avatarId: id,
      });
    } catch (error) {
      await ctx.storage.delete(id);
      throw error;
    }
  },
});
