import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = action;
  },
}));
import { DELETE, GET, POST } from "../../app/api/auth/session/route";
const origin = "https://joti.example";
function request(
  method: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return new NextRequest(`${origin}/api/auth/session`, {
    method,
    headers: { origin, "content-type": "application/json", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  action.mockReset();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
afterEach(() => vi.unstubAllEnvs());

describe("session cookie boundary", () => {
  test("a session is HttpOnly, SameSite and never included in the JSON response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    action.mockResolvedValue({
      email: "owner@example.com",
      token: "private-cookie-token",
      claim: "rotated-browser-proof",
      expiresAt: Date.now() + 60000,
    });
    const result = await POST(
      request("POST", { email: "owner@example.com", token: "initial-proof" }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    expect(result.headers.get("set-cookie")).toContain("Secure");
    expect(result.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(result.headers.get("cache-control")).toBe("no-store");
    const body = await result.text();
    expect(body).toContain("rotated-browser-proof");
    expect(body).not.toContain("private-cookie-token");
  });
  test("cross-origin changes and malformed input fail before any backend action", async () => {
    expect(
      (await POST(request("POST", {}, { origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    expect(
      (
        await DELETE(
          request("DELETE", undefined, { origin: "https://attacker.example" }),
        )
      ).status,
    ).toBe(403);
    expect((await POST(request("POST", null))).status).toBe(400);
    expect((await POST(request("POST", { email: 4, token: [] }))).status).toBe(
      400,
    );
    expect(action).not.toHaveBeenCalled();
  });
  test("a missing cookie is anonymous and an invalid cookie is removed", async () => {
    expect(await (await GET(request("GET"))).json()).toBeNull();
    expect(action).not.toHaveBeenCalled();
    action.mockResolvedValue(null);
    const result = await GET(
      request("GET", undefined, { cookie: "joti-session=expired-proof" }),
    );
    expect(await result.json()).toBeNull();
    expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  test("a transient backend failure preserves the cookie for a retry", async () => {
    action.mockRejectedValue(
      new Error("Provider-specific sensitive diagnostics"),
    );
    const result = await GET(
      request("GET", undefined, { cookie: "joti-session=valid-proof" }),
    );
    expect(result.status).toBe(503);
    expect(result.headers.get("set-cookie")).toBeNull();
    expect(await result.text()).not.toContain("sensitive diagnostics");
  });
  test("sign-out removes the browser cookie even when the revocation service fails", async () => {
    action.mockRejectedValue(new Error("offline"));
    const result = await DELETE(
      request("DELETE", undefined, { cookie: "joti-session=old-proof" }),
    );
    expect(result.status).toBe(503);
    expect(result.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
