import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
export async function POST(r: NextRequest) {
  const reply = (d: unknown, status = 200) =>
    NextResponse.json(d, { status, headers: { "Cache-Control": "no-store" } });
  if (r.headers.get("origin") !== r.nextUrl.origin)
    return reply({ code: "FORBIDDEN" }, 403);
  const token = r.cookies.get("joti-session")?.value;
  if (!token) return reply({ code: "UNAUTHORIZED" }, 401);
  try {
    const reader = r.body?.getReader();
    if (!reader) return reply({ code: "VALIDATION_ERROR" }, 400);
    let body = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
      if (body.length > 4000) {
        await reader.cancel();
        return reply({ code: "VALIDATION_ERROR" }, 400);
      }
    }
    body += decoder.decode();
    const d = JSON.parse(body);
    if (
      typeof d.name !== "string" ||
      typeof d.template !== "string" ||
      typeof d.key !== "string" ||
      [d.background, d.iconColor].some(
        (value) =>
          value !== undefined &&
          (typeof value !== "string" ||
            (value !== "" && !/^#[a-f0-9]{6}$/i.test(value))),
      )
    )
      return reply({ code: "VALIDATION_ERROR" }, 400);
    return reply(
      await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!).action(
        api.spaces.creation.create,
        {
          token,
          name: d.name,
          template: d.template,
          ...(typeof d.icon === "string" ? { icon: d.icon } : {}),
          ...(d.background !== undefined ? { background: d.background } : {}),
          ...(d.iconColor !== undefined ? { iconColor: d.iconColor } : {}),
          key: d.key,
          locale: r.cookies.get("joti-locale")?.value === "en" ? "en" : "es",
        },
      ),
    );
  } catch (e) {
    const code =
      (e as { data?: { code?: string } })?.data?.code ?? "UNAVAILABLE";
    return reply({ code }, code === "UNAUTHORIZED" ? 401 : 400);
  }
}
