import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
  const reply = (value: unknown, status = 200) =>
    NextResponse.json(value, { status, headers });
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const token = request.cookies.get("joti-session")?.value;
  const slug = request.nextUrl.searchParams.get("slug");
  if (!token) return reply({ code: "UNAUTHORIZED" }, 401);
  if (!slug || slug.length > 100)
    return reply({ code: "VALIDATION_ERROR" }, 400);
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return reply({ code: "UNAVAILABLE" }, 503);
  try {
    return reply(
      await new ConvexHttpClient(url).action(api.lists.session.connect, {
        token,
        slug,
      }),
    );
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    return reply(
      { code: text.includes("UNAUTHORIZED") ? "UNAUTHORIZED" : "UNAVAILABLE" },
      text.includes("UNAUTHORIZED") ? 401 : 503,
    );
  }
}
