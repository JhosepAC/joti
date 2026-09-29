import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  SPACE_SLUG_MAX_ATTEMPTS,
  type SpaceIcon,
  type SpacePurpose,
} from "./constants";
import { toSlugBase, validateSpaceIcon, validateSpaceName, validateSpacePurpose } from "./validators";

// ---------------------------------------------------------------------------
// Space creation.
//
// `internalMutation` on purpose: the caller cannot supply an owner id. The
// public entry point is `spaces.actions.createFirstSpace`, which resolves the
// owner from a claim grant and calls in here with the id it found.
//
// The guards live here rather than in the action because this is the write that
// has to be atomic with them — Convex mutations are optimistically concurrent,
// so a check performed in the action is a check that can be raced.
// ---------------------------------------------------------------------------

export const createFirstSpace = internalMutation({
  args: {
    owner_id: v.id("auth_users"),
    name: v.string(),
    icon: v.string(),
    purpose: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ spaceId: Id<"spaces">; slug: string; name: string; icon: SpaceIcon; purpose: SpacePurpose }> => {
    const name = validateSpaceName(args.name);
    const icon = validateSpaceIcon(args.icon);
    const purpose = validateSpacePurpose(args.purpose);

    const user = await ctx.db.get(args.owner_id);
    if (!user || user.deleted_at) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Account not found." });
    }

    // The onboarding is only reachable with a completed profile, and that is
    // enforced here rather than trusted from the client.
    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.owner_id))
      .first();
    if (!profile) {
      throw new ConvexError({
        code: "PROFILE_REQUIRED",
        message: "Completa tu perfil antes de crear tu espacio.",
      });
    }

    // "First space" is enforced, not just named that way: this endpoint is the
    // onboarding step, so it refuses once a space exists. Re-running the flow is
    // therefore idempotent by construction and cannot be used to farm spaces.
    const existing = await ctx.db
      .query("spaces")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", args.owner_id))
      .first();
    if (existing && !existing.deleted_at) {
      throw new ConvexError({
        code: "SPACE_ALREADY_EXISTS",
        message: "Ya tienes un espacio. Puedes entrar a él desde el inicio.",
      });
    }

    // Slug is globally unique because `/w/<slug>` has no owner segment, so two
    // accounts naming their space the same thing must still be addressable.
    // Guessability is not a disclosure here: the route only renders a space to a
    // caller holding a grant bound to that space.
    const base = toSlugBase(name);
    let slug = base;
    for (let attempt = 2; attempt <= SPACE_SLUG_MAX_ATTEMPTS; attempt += 1) {
      const taken = await ctx.db
        .query("spaces")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!taken) break;
      slug = `${base}-${attempt}`;
    }
    const conflict = await ctx.db
      .query("spaces")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (conflict) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "No pudimos generar una dirección única para este espacio. Prueba con otro nombre.",
      });
    }

    const spaceId = await ctx.db.insert("spaces", {
      owner_id: args.owner_id,
      name,
      slug,
      icon,
      purpose,
      // Spaces start private; inviting collaborators is a later step and the
      // onboarding shows this as an informational badge, not an input.
      is_private: true,
      created_at: Date.now(),
    });

    return { spaceId, slug, name, icon, purpose };
  },
});
