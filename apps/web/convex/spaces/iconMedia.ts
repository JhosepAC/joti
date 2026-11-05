import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function requireSpaceIcon(
  ctx: MutationCtx,
  spaceId: Id<"spaces">,
  key: string,
) {
  const image =
    key.length <= 100 &&
    (await ctx.db
      .query("gallery_images")
      .withIndex("by_space_key", (q) =>
        q.eq("space_id", spaceId).eq("key", key),
      )
      .first());
  if (
    !image ||
    image.status !== "ready" ||
    image.originalBytes > 128 * 1024 ||
    image.width > 256 ||
    image.height > 256
  ) {
    throw new ConvexError({ code: "INVALID_IMAGE" });
  }
  return image;
}
