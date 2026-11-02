import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { archive } from "@/features/gallery/server/archive";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return NextResponse.json(
      { code: "UNAUTHORIZED" },
      { status: 403, headers },
    );
  const token = request.cookies.get("nook-session")?.value;
  if (!token)
    return NextResponse.json(
      { code: "UNAUTHORIZED" },
      { status: 401, headers },
    );
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error("VALIDATION_ERROR");
    let length = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16000) {
        await reader.cancel();
        throw Error("VALIDATION_ERROR");
      }
      chunks.push(value);
    }
    const raw = new Uint8Array(length);
    let offset = 0;
    for (const c of chunks) {
      raw.set(c, offset);
      offset += c.length;
    }
    const text = new TextDecoder().decode(raw);
    if (text.length > 16000) throw Error("VALIDATION_ERROR");
    const body = JSON.parse(text);
    if (
      !Array.isArray(body.keys) ||
      !body.keys.length ||
      body.keys.length > 100 ||
      body.keys.some(
        (k: unknown) => typeof k !== "string" || !/^[-\w]{8,100}$/.test(k),
      )
    )
      throw Error("VALIDATION_ERROR");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
      files: { name: string; bytes: Uint8Array }[] = [];
    let total = 0;
    for (const key of new Set<string>(body.keys)) {
      const result = await client.action(api.gallery.files.media, {
        token,
        slug: request.nextUrl.searchParams.get("slug") ?? "",
        key,
        variant: "original",
      });
      total += result.bytes.byteLength;
      if (total > 64 * 1024 * 1024) throw Error("DOWNLOAD_LIMIT");
      files.push({
        name: result.filename,
        bytes: new Uint8Array(result.bytes),
      });
    }
    return new Response(archive(files), {
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="nook-gallery.zip"',
      },
    });
  } catch (e) {
    const code =
      (e as { data?: { code?: string } })?.data?.code ??
      (e instanceof Error &&
      ["VALIDATION_ERROR", "DOWNLOAD_LIMIT"].includes(e.message)
        ? e.message
        : "UNAVAILABLE");
    return NextResponse.json(
      { code },
      { status: code === "UNAUTHORIZED" ? 401 : 400, headers },
    );
  }
}
