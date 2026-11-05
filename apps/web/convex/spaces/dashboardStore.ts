import {
  validateSpaceName,
  validateSpaceIcon,
  validateSpaceBackground,
} from "./validators";
import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";

/** Every operation authorizes the durable session and space owner in one transaction. */
export const operate = internalMutation({
  args: {
    token_hash: v.string(),
    slug: v.string(),
    locale: v.string(),
    operation: v.union(
      v.literal("load"),
      v.literal("configure"),
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
  handler: async (ctx, args) => {
    const fail = (code: string): never => {
      throw new ConvexError({ code });
    };
    const session = await ctx.db
      .query("auth_sessions")
      .withIndex("by_token_hash", (q) => q.eq("token_hash", args.token_hash))
      .first();
    if (!session || session.expires_at <= Date.now())
      return fail("UNAUTHORIZED");
    const user = await ctx.db.get(session.user_id);
    if (!user || user.deleted_at || !user.email_verified_at)
      return fail("UNAUTHORIZED");
    const owned = (
      await ctx.db
        .query("spaces")
        .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
        .collect()
    ).filter((space) => !space.deleted_at);
    const space = owned.find((space) => space.slug === args.slug);
    if (!space) return fail("NOT_FOUND");
    if (args.operation === "configure") {
      if (args.order !== undefined) {
        if (
          args.order.length !== owned.length ||
          new Set(args.order).size !== owned.length ||
          args.order.some((slug) => !owned.some((s) => s.slug === slug))
        )
          return fail("VALIDATION_ERROR");
        for (const [index, slug] of args.order.entries()) {
          const item = owned.find((s) => s.slug === slug)!;
          item.rail_position = index;
          await ctx.db.patch(item._id, { rail_position: index });
        }
      }
      if (args.background !== undefined)
        space.icon_background = validateSpaceBackground(args.background);
      if (args.iconColor !== undefined)
        space.icon_color =
          validateSpaceBackground(args.iconColor, "icon") || undefined;
      if (args.favorite !== undefined) space.favorite = args.favorite;
      if (
        args.name !== undefined ||
        args.icon !== undefined ||
        args.background !== undefined ||
        args.iconColor !== undefined ||
        args.description !== undefined ||
        args.modules !== undefined
      )
        space.edited_at = Date.now();
      if (args.name !== undefined) space.name = validateSpaceName(args.name);
      if (args.description !== undefined) {
        if (
          args.description.length > 280 ||
          /[\u0000-\u001f]/.test(args.description)
        )
          return fail("VALIDATION_ERROR");
        space.description = args.description.trim();
      }
      if (args.icon !== undefined)
        space.icon =
          /^symbol:(table|check|basket|plane|book|briefcase|heart|bolt|pin|tag)$/.test(
            args.icon,
          )
            ? args.icon
            : validateSpaceIcon(args.icon);
      if (args.modules !== undefined) {
        if (
          args.modules.length > 5 ||
          new Set(args.modules).size !== args.modules.length ||
          args.modules.some(
            (m) =>
              !["pages", "lists", "calendar", "notes", "gallery"].includes(m),
          )
        )
          return fail("VALIDATION_ERROR");
        space.enabled_modules = args.modules;
      }
      await ctx.db.patch(space._id, {
        icon_background: space.icon_background,
        icon_color: space.icon_color,
        favorite: space.favorite,
        edited_at: space.edited_at,
        name: space.name,
        icon: space.icon,
        description: space.description,
        enabled_modules: space.enabled_modules,
      });
    }
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();
    const now = Date.now();
    let selectedPageId = args.pageId;
    if (!space.starter_initialized_at) {
      const existing = await ctx.db
        .query("space_pages")
        .withIndex("by_space_id", (q) => q.eq("space_id", space._id))
        .first();
      if (!existing) {
        const es = args.locale !== "en";
        selectedPageId = await ctx.db.insert("space_pages", {
          space_id: space._id,
          title:
            space.purpose === "blank"
              ? es
                ? "Sin título"
                : "Untitled"
              : es
                ? "Empieza aquí"
                : "Start here",
          body:
            space.purpose === "blank"
              ? ""
              : es
                ? `Este es tu espacio: ${space.name}.\n\nUn lugar para guardar lo que quieres recordar, ordenar una idea y volver a ella cuando la necesites.\n\nHazlo tuyo\nCambia el título y escribe aquí tu primera idea. Puedes crear más páginas desde la barra lateral.\n\nUna idea para empezar\n¿Qué te gustaría organizar en este espacio?`
                : `This is your space: ${space.name}.\n\nA home for things worth remembering, ideas to untangle, and thoughts to return to.\n\nMake it yours\nChange this title and write your first idea. Create more pages from the sidebar.\n\nA place to begin\nWhat would you like to organize in this space?`,
          revision: 1,
          created_at: now,
          updated_at: now,
          is_starter: true,
        });
      }
      await ctx.db.patch(space._id, { starter_initialized_at: now });
    }
    if (args.operation === "create") {
      const count = await ctx.db
        .query("space_pages")
        .withIndex("by_space_id", (q) => q.eq("space_id", space._id))
        .take(201);
      if (count.length >= 200) return fail("PAGE_LIMIT");
      selectedPageId = await ctx.db.insert("space_pages", {
        space_id: space._id,
        title: args.locale === "en" ? "Untitled" : "Sin título",
        body: "",
        revision: 1,
        created_at: now,
        updated_at: now,
        is_starter: false,
      });
    }
    if (args.operation === "save") {
      if (
        !args.pageId ||
        typeof args.title !== "string" ||
        typeof args.body !== "string" ||
        !args.title.trim() ||
        args.title.length > 120 ||
        args.body.length > 30000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(args.title + args.body)
      )
        return fail("VALIDATION_ERROR");
      const page = await ctx.db.get(args.pageId);
      if (!page || page.space_id !== space._id) return fail("NOT_FOUND");
      if (args.revision !== page.revision) return fail("CONFLICT");
      await ctx.db.patch(page._id, {
        title: args.title.trim(),
        body: args.body,
        revision: page.revision + 1,
        updated_at: now,
      });
    }
    if (
      ["rename", "duplicate", "favorite", "delete", "icon"].includes(
        args.operation,
      )
    ) {
      if (!args.pageId) return fail("VALIDATION_ERROR");
      const target = await ctx.db.get(args.pageId);
      if (!target || target.space_id !== space._id) return fail("NOT_FOUND");
      if (args.operation === "delete") {
        if (args.revision !== target.revision) return fail("CONFLICT");
        await ctx.db.delete(target._id);
        selectedPageId = undefined;
      } else if (args.operation === "icon") {
        if (
          !args.icon ||
          ![
            "book",
            "briefcase",
            "heart",
            "bolt",
            "pin",
            "tag",
            "check",
            "plane",
            "basket",
            "table",
          ].includes(args.icon)
        )
          return fail("VALIDATION_ERROR");
        await ctx.db.patch(target._id, { icon: args.icon });
      } else if (args.operation === "favorite") {
        if (typeof args.favorite !== "boolean") return fail("VALIDATION_ERROR");
        await ctx.db.patch(target._id, { favorite: args.favorite });
      } else if (args.operation === "rename") {
        if (
          !args.title?.trim() ||
          args.title.length > 120 ||
          /[\u0000-\u001f]/.test(args.title)
        )
          return fail("VALIDATION_ERROR");
        if (args.revision !== target.revision) return fail("CONFLICT");
        await ctx.db.patch(target._id, {
          title: args.title.trim(),
          revision: target.revision + 1,
          updated_at: now,
        });
      } else {
        const count = await ctx.db
          .query("space_pages")
          .withIndex("by_space_id", (q) => q.eq("space_id", space._id))
          .take(200);
        if (count.length >= 200) return fail("PAGE_LIMIT");
        selectedPageId = await ctx.db.insert("space_pages", {
          space_id: space._id,
          title: (args.locale === "en"
            ? target.title + " (copy)"
            : target.title + " (copia)"
          ).slice(0, 120),
          body: target.body,
          icon: target.icon,
          revision: 1,
          created_at: now,
          updated_at: now,
          is_starter: false,
          favorite: false,
        });
      }
    }
    if (!["load", "configure"].includes(args.operation)) {
      space.edited_at = Date.now();
      await ctx.db.patch(space._id, { edited_at: space.edited_at });
    }
    const pages = await ctx.db
      .query("space_pages")
      .withIndex("by_space_id", (q) => q.eq("space_id", space._id))
      .collect();
    let avatarUrl: string | null = null;
    if (profile?.avatar) {
      if (
        profile.avatar.startsWith("https://") ||
        profile.avatar.startsWith("/")
      )
        avatarUrl = profile.avatar;
      else
        try {
          avatarUrl = await ctx.storage.getUrl(
            profile.avatar as import("../_generated/dataModel").Id<"_storage">,
          );
        } catch {}
    }
    return {
      space: {
        slug: space.slug,
        name: space.name,
        icon: space.icon,
        purpose: space.purpose,
        modules: space.enabled_modules ?? [],
        description: space.description ?? "",
        favorite: space.favorite ?? false,
        background: space.icon_background ?? "",
        iconColor: space.icon_color ?? "",
        editedAt: space.edited_at,
        editedBy: space.edited_at
          ? profile?.display_name || profile?.username || user.email
          : undefined,
      },
      spaces: owned
        .sort(
          (a, b) =>
            (a.rail_position ?? a.created_at) -
            (b.rail_position ?? b.created_at),
        )
        .map((item) => ({
          slug: item.slug,
          name: item.name,
          icon: item.icon,
          purpose: item.purpose,
          description: item.description ?? "",
          modules: item.enabled_modules ?? [],
          favorite: item.favorite ?? false,
          background: item.icon_background ?? "",
          iconColor: item.icon_color ?? "",
          editedAt: item.edited_at,
          editedBy: item.edited_at
            ? profile?.display_name || profile?.username || user.email
            : undefined,
        })),
      profile: {
        displayName: profile?.display_name ?? "",
        avatarUrl,
        timezone: profile?.timezone ?? "UTC",
        username: profile?.username ?? "",
      },
      pages: pages.map((page) => ({
        id: page._id,
        icon: page.icon,
        title: page.title,
        body: page.body,
        revision: page.revision,
        createdAt: page.created_at,
        updatedAt: page.updated_at,
        isStarter: page.is_starter,
        favorite: page.favorite ?? false,
      })),
      selectedPageId,
    };
  },
});
