import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const COOKIE = "joti-session";
const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}
function client() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Backend unavailable");
  return new ConvexHttpClient(url);
}
function sameOrigin(request: NextRequest) {
  return (
    request.headers.get("origin") === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
function clearCookie(result: NextResponse) {
  result.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return result;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response({ error: "Forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return response({ error: "Invalid request" }, 415);
  let input: { email?: unknown; token?: unknown };
  try {
    input = await request.json();
  } catch {
    return response({ error: "Invalid request" }, 400);
  }
  if (!input || typeof input !== "object")
    return response({ error: "Invalid request" }, 400);
  try {
    if (
      typeof input.email !== "string" ||
      typeof input.token !== "string" ||
      input.email.length > 320 ||
      input.token.length > 256
    )
      return response({ error: "Invalid request" }, 400);
    const backend = client();
    const session = await backend.action(api.auth.sessions.createSession, {
      email: input.email,
      claim: input.token,
    });
    const result = response({ email: session.email, token: session.claim });
    result.cookies.set(COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    if (session.locale === "es" || session.locale === "en")
      result.cookies.set("joti-locale", session.locale, {
        path: "/",
        sameSite: "lax",
        maxAge: 31536000,
      });
    return result;
  } catch {
    return response({ error: "Could not establish session" }, 503);
  }
}

export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return response({ error: "Forbidden" }, 403);
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return response(null);
  try {
    const session = await client().action(api.auth.sessions.resumeSession, {
      token,
    });
    if (!session) return clearCookie(response(null));
    return response({ email: session.email, token: session.claim });
  } catch {
    return response({ error: "Session unavailable" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return response({ error: "Forbidden" }, 403);
  const token = request.cookies.get(COOKIE)?.value;
  try {
    if (token)
      await client().action(api.auth.sessions.revokeSession, { token });
    return clearCookie(response({ success: true }));
  } catch {
    return clearCookie(response({ success: false }, 503));
  }
}
