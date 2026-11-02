"use node";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { randomUUID, createHash } from "node:crypto";
import { sha256Hex } from "../auth/crypto";
import { derive } from "./processing";
import { fail } from "./model";
export const process = internalAction({
  args: { id: v.id("gallery_images"), attempt: v.string() },
  handler: async (ctx, args) => {
    const image = await ctx.runQuery(internal.gallery.store.source, args);
    if (!image?.original) return;
    const stored: Id<"_storage">[] = [];
    let attached = false;
    try {
      const original = await ctx.storage.get(image.original);
      if (!original) throw Error("NOT_FOUND");
      const result = await derive(Buffer.from(await original.arrayBuffer()));
      const ids = {} as Record<
        "high" | "medium" | "thumb" | "placeholder",
        Id<"_storage">
      >;
      let bytes = 0;
      const byHash = new Map<string, Id<"_storage">>();
      for (const variant of result.variants) {
        const hash = createHash("sha256").update(variant.data).digest("hex");
        const existing = byHash.get(hash);
        if (existing) {
          ids[variant.name] = existing;
          continue;
        }
        const id = await ctx.storage.store(
          new Blob([new Uint8Array(variant.data)], { type: "image/webp" }),
        );
        stored.push(id);
        byHash.set(hash, id);
        ids[variant.name] = id;
        bytes += variant.data.length;
      }
      attached = await ctx.runMutation(internal.gallery.store.processed, {
        ...args,
        ...ids,
        width: result.width,
        height: result.height,
        bytes,
        highWidth: result.variants.find((v) => v.name === "high")!.width,
        mediumWidth: result.variants.find((v) => v.name === "medium")!.width,
        thumbWidth: result.variants.find((v) => v.name === "thumb")!.width,
        ...(result.capturedAt !== undefined
          ? { capturedAt: result.capturedAt }
          : {}),
      });
    } catch (e) {
      const code =
        (e as { data?: { code?: string } })?.data?.code ??
        (e instanceof Error &&
        ["INVALID_IMAGE", "UNSUPPORTED_FORMAT"].includes(e.message)
          ? e.message
          : String(e).includes("pixel limit")
            ? "INVALID_IMAGE"
            : "PROCESSING_FAILED");
      await ctx.runMutation(internal.gallery.store.failed, {
        ...args,
        error: code,
      });
    } finally {
      if (!attached) for (const id of stored) await ctx.storage.delete(id);
    }
  },
});
export const retry = action({
  args: { ticket: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.gallery.store.retry, {
      ...args,
      attempt: randomUUID(),
    });
  },
});
export const media = action({
  args: {
    token: v.string(),
    slug: v.string(),
    key: v.string(),
    variant: v.string(),
  },
  handler: async (
    ctx,
    { token, ...args },
  ): Promise<{ bytes: ArrayBuffer; mime: string; filename: string }> => {
    const source = await ctx.runQuery(internal.gallery.store.media, {
      ...args,
      hash: sha256Hex(token),
    });
    let file: Blob | null = null;
    for (const id of source.ids) {
      file = await ctx.storage.get(id);
      if (file) break;
    }
    if (!file) fail("NOT_FOUND");
    return {
      bytes: await file.arrayBuffer(),
      mime: source.mime,
      filename: source.filename,
    };
  },
});
