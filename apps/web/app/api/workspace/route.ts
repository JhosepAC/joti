import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers });
async function operate(
  request: NextRequest,
  operation: "load" | "create" | "save" | "item",
) {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (operation !== "load" &&
      request.headers.get("origin") !== request.nextUrl.origin)
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const token = request.cookies.get("nook-session")?.value;
  if (!token) return reply({ code: "UNAUTHORIZED" }, 401);
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug || slug.length > 100)
    return reply({ code: "VALIDATION_ERROR" }, 400);
  let input: {
    pageId?: string;
    title?: string;
    body?: string;
    revision?: number;
    action?: "rename" | "duplicate" | "favorite";
    favorite?: boolean;
  } = {};
  if (operation === "save" || operation === "item") {
    if (
      !request.headers.get("content-type")?.startsWith("application/json") ||
      Number(request.headers.get("content-length") ?? 0) > 150000
    )
      return reply({ code: "VALIDATION_ERROR" }, 400);
    try {
      input = await request.json();
    } catch {
      return reply({ code: "VALIDATION_ERROR" }, 400);
    }
    if (
      !input ||
      typeof input.pageId !== "string" ||
      (operation === "save" &&
        (typeof input.title !== "string" ||
          typeof input.body !== "string" ||
          !Number.isSafeInteger(input.revision) ||
          input.title.length > 120 ||
          input.body.length > 30000)) ||
      (operation === "item" &&
        (!["rename", "duplicate", "favorite"].includes(input.action ?? "") ||
          (input.action === "rename" &&
            (typeof input.title !== "string" ||
              input.title.length > 120 ||
              !Number.isSafeInteger(input.revision))) ||
          (input.action === "favorite" && typeof input.favorite !== "boolean")))
    )
      return reply({ code: "VALIDATION_ERROR" }, 400);
  }
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("Backend unavailable");
    const result = await new ConvexHttpClient(url).action(
      api.spaces.dashboard.operate,
      {
        token,
        slug,
        operation: operation === "item" ? input.action! : operation,
        locale:
          request.cookies.get("nook-locale")?.value === "en" ? "en" : "es",
        ...(operation === "save"
          ? {
              pageId: input.pageId as Id<"space_pages">,
              title: input.title,
              body: input.body,
              revision: input.revision,
            }
          : operation === "item"
            ? {
                pageId: input.pageId as Id<"space_pages">,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.revision !== undefined
                  ? { revision: input.revision }
                  : {}),
                ...(input.favorite !== undefined
                  ? { favorite: input.favorite }
                  : {}),
              }
            : {}),
      },
    );
    return reply(result);
  } catch (error) {
    const data = error instanceof ConvexError ? error.data : null;
    const code =
      data && typeof data === "object" && "code" in data
        ? String(data.code)
        : "UNAVAILABLE";
    const status =
      code === "UNAUTHORIZED"
        ? 401
        : code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
            : code === "VALIDATION_ERROR" || code === "PAGE_LIMIT"
              ? 400
              : 503;
    return reply({ code }, status);
  }
}
export const GET = (request: NextRequest) => operate(request, "load");
export const POST = (request: NextRequest) => operate(request, "create");
export const PATCH = (request: NextRequest) => operate(request, "save");
export const PUT = (request: NextRequest) => operate(request, "item");
