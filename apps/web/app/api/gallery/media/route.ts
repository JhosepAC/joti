import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = {
    "Cache-Control": "private, no-cache",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  const token = request.cookies.get("nook-session")?.value;
  if (!token || request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json(
      { code: "UNAUTHORIZED" },
      { status: 401, headers },
    );
  try {
    const params = request.nextUrl.searchParams;
    const media = await new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL!,
    ).action(api.gallery.files.media, {
      token,
      slug: params.get("slug") ?? "",
      key: params.get("key") ?? "",
      variant: params.get("variant") ?? "thumb",
    });
    const etag = `"${createHash("sha256").update(new Uint8Array(media.bytes)).digest("hex")}"`;
    // Revalidate ownership before honoring the browser's private cached copy.
    if (
      params.get("download") !== "1" &&
      request.headers.get("if-none-match") === etag
    )
      return new Response(null, {
        status: 304,
        headers: { ...headers, ETag: etag },
      });
    const filename = media.filename.replace(/[\r\n"\\]/g, "_");
    return new Response(media.bytes, {
      headers: {
        ...headers,
        ETag: etag,
        "Content-Type": media.mime,
        ...(params.get("download") === "1"
          ? {
              "Cache-Control": "private, no-store",
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
            }
          : {}),
      },
    });
  } catch (e) {
    const code =
      (e as { data?: { code?: string } })?.data?.code ?? "UNAVAILABLE";
    return NextResponse.json(
      { code },
      {
        status:
          code === "UNAUTHORIZED"
            ? 401
            : code === "NOT_FOUND" || code === "NOT_READY"
              ? 404
              : 503,
        headers,
      },
    );
  }
}
