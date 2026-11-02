import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { sniff } from "./sniff";
import { fail } from "./model";
// Originals use the Convex runtime; Node action arguments have a lower 5 MiB ceiling.
export const upload = action({
  args: {
    ticket: v.string(),
    bytes: v.bytes(),
    filename: v.string(),
    key: v.string(),
    albumId: v.optional(v.id("gallery_albums")),
  },
  handler: async (ctx, args): Promise<{ key: string; duplicate: boolean }> => {
    const input = new Uint8Array(args.bytes);
    let mime: string;
    try {
      mime = sniff(input);
    } catch (e) {
      fail((e as Error).message);
    }
    const attempt = crypto.randomUUID();
    const reserved = await ctx.runMutation(internal.gallery.store.reserve, {
      ticket: args.ticket,
      key: args.key,
      hash: Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", args.bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join(""),
      filename: args.filename,
      mime,
      bytes: input.length,
      attempt,
      ...(args.albumId ? { albumId: args.albumId } : {}),
    });
    if (reserved.duplicate) return { key: reserved.key, duplicate: true };
    let id: Id<"_storage"> | undefined;
    try {
      id = await ctx.storage.store(
        new Blob([new Uint8Array(input)], { type: mime }),
      );
      await ctx.runMutation(internal.gallery.store.attach, {
        ticket: args.ticket,
        id: reserved.id,
        attempt,
        original: id,
      });
      return { key: reserved.key, duplicate: false };
    } catch (e) {
      if (id) await ctx.storage.delete(id);
      await ctx.runMutation(internal.gallery.store.failed, {
        id: reserved.id,
        attempt,
        error: "UPLOAD_FAILED",
      });
      throw e;
    }
  },
});
