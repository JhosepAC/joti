import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
async function handle(request: NextRequest) {
  const reply = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store", Vary: "Cookie" },
    });
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.method !== "GET" &&
      request.headers.get("origin") !== request.nextUrl.origin)
  )
    return reply({ code: "FORBIDDEN" }, 403);
  const token = request.cookies.get("joti-session")?.value;
  if (!token) return reply({ code: "UNAUTHORIZED" }, 401);
  try {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw Error();
    const client = new ConvexHttpClient(url);
    if (
      request.method === "POST" &&
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      if (Number(request.headers.get("content-length")) > 600000)
        return reply({ code: "INVALID_IMAGE" }, 400);
      const file = (await request.formData()).get("avatar");
      if (
        !(file instanceof File) ||
        file.size > 512 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      )
        return reply({ code: "INVALID_IMAGE" }, 400);
      return reply(
        await client.action(api.account.actions.upload, {
          token,
          bytes: await file.arrayBuffer(),
        }),
      );
    }
    let input: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (Number(request.headers.get("content-length")) > 10000)
        return reply({ code: "VALIDATION_ERROR" }, 400);
      try {
        input = await request.json();
        if (!input || typeof input !== "object" || Array.isArray(input))
          return reply({ code: "VALIDATION_ERROR" }, 400);
      } catch {
        return reply({ code: "VALIDATION_ERROR" }, 400);
      }
    }
    const operation = request.method === "GET" ? "load" : input.operation;
    if (
      ![
        "load",
        "save",
        "revoke",
        "revokeOthers",
        "removeAvatar",
        "resetPassword",
      ].includes(String(operation))
    )
      return reply({ code: "VALIDATION_ERROR" }, 400);
    const data = await client.action(api.account.actions.operate, {
      token,
      operation: operation as
        | "load"
        | "save"
        | "revoke"
        | "revokeOthers"
        | "removeAvatar"
        | "resetPassword",
      ...(typeof input.name === "string" ? { name: input.name } : {}),
      ...(typeof input.username === "string"
        ? { username: input.username }
        : {}),
      ...(typeof input.locale === "string" ? { locale: input.locale } : {}),
      ...(typeof input.sessionId === "string"
        ? { sessionId: input.sessionId as Id<"auth_sessions"> }
        : {}),
    });
    return reply(data);
  } catch (error) {
    const code =
      (error as { data?: { code?: string } })?.data?.code ?? "UNAVAILABLE";
    return reply(
      { code },
      code === "UNAUTHORIZED" ? 401 : code === "UNAVAILABLE" ? 503 : 400,
    );
  }
}
export const GET = handle;
export const POST = handle;
