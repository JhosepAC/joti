import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ConvexError } from "convex/values";
const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = action;
  },
}));
import { GET, POST, PATCH, PUT } from "../../app/api/workspace/route";
const origin = "https://nook.example";
function request(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`${origin}/api/workspace?slug=my-space`, {
    method,
    headers: {
      origin,
      cookie: "nook-session=private-token",
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeEach(() => {
  action.mockReset();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
afterEach(() => vi.unstubAllEnvs());
describe("workspace API boundary", () => {
  test("tree actions require same-origin sessions and validated action input", async () => {
    expect(
      (
        await PUT(
          request(
            "PUT",
            { pageId: "page", action: "favorite", favorite: true },
            { origin: "https://other.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await PUT(
          request(
            "PUT",
            { pageId: "page", action: "duplicate" },
            { cookie: "" },
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (await PUT(request("PUT", { pageId: "page", action: "delete" }))).status,
    ).toBe(400);
    expect(
      (
        await PUT(
          request("PUT", {
            pageId: "page",
            action: "rename",
            title: "x",
            revision: "1",
          }),
        )
      ).status,
    ).toBe(400);
    expect(action).not.toHaveBeenCalled();
  });
  test("tree favorite actions pass only explicit metadata to the backend", async () => {
    action.mockResolvedValue({ pages: [] });
    const response = await PUT(
      request("PUT", { pageId: "page", action: "favorite", favorite: true }),
    );
    expect(response.status).toBe(200);
    expect(action.mock.calls[0]?.[1]).toMatchObject({
      operation: "favorite",
      pageId: "page",
      favorite: true,
      token: "private-token",
    });
    expect(action.mock.calls[0]?.[1]).not.toHaveProperty("body");
    expect(await response.text()).not.toContain("private-token");
  });
  test("missing sessions and cross-origin requests cannot reach the backend", async () => {
    expect((await GET(request("GET", undefined, { cookie: "" }))).status).toBe(
      401,
    );
    expect(
      (
        await POST(
          request("POST", undefined, { origin: "https://other.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await GET(request("GET", undefined, { "sec-fetch-site": "cross-site" })))
        .status,
    ).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });
  test("malformed page writes are rejected before the action", async () => {
    expect((await PATCH(request("PATCH", null))).status).toBe(400);
    expect(
      (
        await PATCH(
          request("PATCH", {
            pageId: "test",
            title: "Page",
            body: "x".repeat(30001),
            revision: 1,
          }),
        )
      ).status,
    ).toBe(400);
    expect(action).not.toHaveBeenCalled();
  });
  test("responses are private and never echo the session token", async () => {
    action.mockResolvedValue({ space: { name: "My space" }, pages: [] });
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-token");
    expect(action.mock.calls[0]![1].token).toBe("private-token");
  });
  test("revision conflicts remain distinguishable from transport failures", async () => {
    action.mockRejectedValue(new ConvexError({ code: "CONFLICT" }));
    expect((await GET(request("GET"))).status).toBe(409);
    action.mockRejectedValue(new Error("Unreachable service details"));
    const result = await GET(request("GET"));
    expect(result.status).toBe(503);
    expect(await result.text()).toBe('{"code":"UNAVAILABLE"}');
  });
});
