import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { validateUsername, validateDisplayName } from "../auth/validators";
export const operate = internalMutation({
  args: {
    hash: v.string(),
    operation: v.string(),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    locale: v.optional(v.string()),
    sessionId: v.optional(v.id("auth_sessions")),
    avatarId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.hash))
      .first();
    if (!session || session.expires_at <= Date.now())
      throw new ConvexError({ code: "UNAUTHORIZED" });
    const user = await ctx.db.get(session.user_id);
    if (!user || user.deleted_at || !user.email_verified_at)
      throw new ConvexError({ code: "UNAUTHORIZED" });
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();
    if (!profile) throw new ConvexError({ code: "PROFILE_REQUIRED" });
    if (args.operation === "save") {
      let username, name;
      try {
        username = validateUsername(args.username ?? "");
        name = validateDisplayName(args.name ?? "");
      } catch {
        throw new ConvexError({ code: "VALIDATION_ERROR" });
      }
      if (!["es", "en"].includes(args.locale ?? ""))
        throw new ConvexError({ code: "VALIDATION_ERROR" });
      const other = await ctx.db
        .query("auth_user_profiles")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (other && other.user_id !== user._id)
        throw new ConvexError({ code: "USERNAME_TAKEN" });
      await ctx.db.patch(profile._id, {
        display_name: name,
        username,
        locale: args.locale!,
      });
    }
    if (args.operation === "avatar" || args.operation === "removeAvatar") {
      const old = profile.managed_avatar_id;
      await ctx.db.patch(profile._id, {
        avatar: args.avatarId,
        managed_avatar_id: args.avatarId,
      });
      if (old && old !== args.avatarId) await ctx.storage.delete(old);
    }
    const sessions = await ctx.db
      .query("auth_sessions")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    if (args.operation === "revoke") {
      const target = sessions.find((s) => s._id === args.sessionId);
      if (!target || target._id === session._id)
        throw new ConvexError({ code: "NOT_FOUND" });
      await ctx.db.delete(target._id);
    }
    if (args.operation === "revokeOthers")
      for (const row of sessions)
        if (row._id !== session._id) await ctx.db.delete(row._id);
    if (args.operation === "revoke" || args.operation === "revokeOthers") {
      const grants = await ctx.db
        .query("auth_claim_grants")
        .withIndex("by_email", (q) => q.eq("email", user.email))
        .collect();
      for (const grant of grants) await ctx.db.delete(grant._id);
    }
    const updated = await ctx.db.get(profile._id);
    const avatar = updated?.avatar;
    let avatarUrl: string | null = null;
    if (avatar) {
      if (avatar.startsWith("https://") || avatar.startsWith("/"))
        avatarUrl = avatar;
      else
        try {
          avatarUrl = await ctx.storage.getUrl(
            avatar as import("../_generated/dataModel").Id<"_storage">,
          );
        } catch {}
    }
    return {
      email: user.email,
      name: updated!.display_name,
      username: updated!.username,
      locale: updated!.locale,
      avatarUrl,
      createdAt: user._creationTime,
      sessions: sessions
        .filter(
          (s) =>
            s.expires_at > Date.now() &&
            !(args.operation === "revoke" && s._id === args.sessionId) &&
            !(args.operation === "revokeOthers" && s._id !== session._id),
        )
        .map((s) => ({
          id: s._id,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
          current: s._id === session._id,
        })),
    };
  },
});
