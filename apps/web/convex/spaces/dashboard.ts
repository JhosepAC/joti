"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { sha256Hex } from "../auth/crypto";
import { validateSlug } from "./validators";

export const operate = action({
  args: {
    token: v.string(),
    slug: v.string(),
    locale: v.string(),
    operation: v.union(
      v.literal("load"),
      v.literal("configure"),
      v.literal("deleteSpace"),
      v.literal("create"),
      v.literal("save"),
      v.literal("duplicate"),
      v.literal("rename"),
      v.literal("favorite"),
      v.literal("delete"),
      v.literal("icon"),
    ),
    background: v.optional(v.string()),
    iconColor: v.optional(v.string()),
    order: v.optional(v.array(v.string())),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    modules: v.optional(v.array(v.string())),
    pageId: v.optional(v.id("space_pages")),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    revision: v.optional(v.number()),
    favorite: v.optional(v.boolean()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }): Promise<unknown> =>
    ctx.runMutation(internal.spaces.dashboardStore.operate, {
      ...args,
      slug: validateSlug(args.slug),
      token_hash: sha256Hex(token),
    }),
});
