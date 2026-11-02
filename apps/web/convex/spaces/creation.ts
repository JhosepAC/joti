"use node";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { sha256Hex } from "../auth/crypto";
export const create = action({
  args: {
    token: v.string(),
    name: v.string(),
    template: v.string(),
    key: v.string(),
    locale: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }): Promise<{ slug: string }> =>
    ctx.runMutation(internal.spaces.create.create, {
      ...args,
      hash: sha256Hex(token),
    }),
});
