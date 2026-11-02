import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_FILE_BYTES } from "@/convex/gallery/model";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const reply = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const token = request.cookies.get("nook-session")?.value;
  if (!token) return reply({ code: "UNAUTHORIZED" }, 401);
  try {
    // Bound the stream too: Content-Length is untrusted and can be absent.
    const reader = request.body?.getReader();
    if (!reader) return reply({ code: "INVALID_IMAGE" }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FILE_BYTES + 65536) {
        await reader.cancel();
        return reply({ code: "INVALID_IMAGE" }, 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      body.set(c, offset);
      offset += c.length;
    }
    const form = await new Request("http://local", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      body,
    }).formData();
    const file = form.get("file"),
      key = form.get("key"),
      albumId = form.get("albumId");
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    if (
      !(file instanceof File) ||
      file.size > MAX_FILE_BYTES ||
      typeof key !== "string" ||
      !slug
    )
      return reply({ code: "INVALID_IMAGE" }, 400);
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const access = await client.action(api.lists.session.connect, {
      token,
      slug,
    });
    return reply(
      await client.action(api.gallery.uploads.upload, {
        ticket: access.ticket,
        filename: file.name,
        key,
        bytes: await file.arrayBuffer(),
        ...(typeof albumId === "string" && albumId
          ? { albumId: albumId as Id<"gallery_albums"> }
          : {}),
      }),
    );
  } catch (e) {
    const code =
      (e as { data?: { code?: string } })?.data?.code ?? "UNAVAILABLE";
    return reply(
      { code },
      code === "UNAUTHORIZED" ? 401 : code === "UNAVAILABLE" ? 503 : 400,
    );
  }
}
