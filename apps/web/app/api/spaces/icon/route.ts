import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
export async function POST(r: NextRequest) {
  if (r.headers.get("origin") !== r.nextUrl.origin)
    return new Response(null, { status: 403 });
  const token = r.cookies.get("nook-session")?.value;
  if (!token) return new Response(null, { status: 401 });
  try {
    if (Number(r.headers.get("content-length")) > 1000) throw Error();
    const { slug, key } = await r.json();
    if (
      typeof slug !== "string" ||
      typeof key !== "string" ||
      slug.length > 100 ||
      key.length > 100
    )
      throw Error();
    const c = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
      access = await c.action(api.lists.session.connect, { token, slug });
    await c.mutation(api.spaces.icons.set, { ticket: access.ticket, key });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ code: "INVALID_IMAGE" }, { status: 400 });
  }
}
