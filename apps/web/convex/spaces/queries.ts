import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { validateSpacePurpose } from "./validators";
import { resolveTemplate } from "./templates";

// ---------------------------------------------------------------------------
// Spaces reads.
//
// Only one public query exists and it exposes no user data: `getPurposePreview`
// maps a purpose (one of four constants) to the template that will be applied,
// so the summary step can show the enabled tools without hardcoding them on the
// client. Everything that touches an account is an `internalQuery`.
// ---------------------------------------------------------------------------

/** What the onboarding needs to render itself: the display name for the default. */
export const getOnboardingContext = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("auth_users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (!user || user.deleted_at) {
      throw new ConvexError({ code: "VALIDATION_ERROR", message: "Account not found." });
    }

    const profile = await ctx.db
      .query("auth_user_profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .first();

    // Only what the caller may see about themselves: their own spaces, oldest
    // first. No owner email, no ids that are not needed by the client.
    const spaces = await ctx.db
      .query("spaces")
      .withIndex("by_owner_id", (q) => q.eq("owner_id", user._id))
      .collect();

    const mine = spaces
      .filter((space) => !space.deleted_at)
      .sort((a, b) => a.created_at - b.created_at)
      .map((space) => ({
        // The id is included because the entry gate has to bind the space grant
        // it returns to this exact space. It is the caller's own space, reached
        // through a grant, so it discloses nothing.
        id: space._id,
        slug: space.slug,
        name: space.name,
        icon: space.icon,
        purpose: space.purpose,
      }));

    return {
      userId: user._id as Id<"auth_users">,
      hasProfile: profile !== null,
      displayName: profile?.display_name ?? null,
      spaces: mine,
    };
  },
});

/** Loads one space by id. Used after a space grant has been validated. */
export const getById = internalQuery({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const space = await ctx.db.get(args.spaceId);
    if (!space || space.deleted_at) return null;
    return space;
  },
});

// --- Public surface -------------------------------------------------------

/**
 * Purpose → template + enabled tools.
 *
 * Static data derived from a closed enumeration, so this is safe to expose: it
 * reveals nothing about any account and cannot be used as an existence oracle.
 */
export const getPurposePreview = query({
  args: { purpose: v.string() },
  handler: async (_ctx, args) => {
    const purpose = validateSpacePurpose(args.purpose);
    const template = resolveTemplate(purpose);
    return {
      purpose,
      templateKey: template.templateKey,
      tools: template.tools.map((tool) => ({ key: tool.key, label: tool.label })),
    };
  },
});
