import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = action;
  },
}));
import { POST } from "../../app/api/lists/access/route";
function request(headers: Record<string, string> = {}, slug = "my-space") {
  return new NextRequest("https://joti.example/api/lists/access?slug=" + slug, {
    method: "POST",
    headers: {
      origin: "https://joti.example",
      cookie: "joti-session=private-browser-token",
      ...headers,
    },
  });
}
beforeEach(() => {
  action.mockReset();
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
});
afterEach(() => vi.unstubAllEnvs());
test("list ticket boundary rejects absent sessions and cross-site requests", async () => {
  expect((await POST(request({ cookie: "" }))).status).toBe(401);
  expect(
    (await POST(request({ origin: "https://other.example" }))).status,
  ).toBe(403);
  expect((await POST(request({ "sec-fetch-site": "cross-site" }))).status).toBe(
    403,
  );
  expect(action).not.toHaveBeenCalled();
});
test("list ticket response only returns scoped short-lived access and cannot be cached", async () => {
  action.mockResolvedValue({
    ticket: "short-lived-space-ticket",
    expiresAt: 1234,
  });
  const response = await POST(request());
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual({
    ticket: "short-lived-space-ticket",
    expiresAt: 1234,
  });
  expect(action.mock.calls[0]?.[1]).toEqual({
    token: "private-browser-token",
    slug: "my-space",
  });
});
test("authorization and transport failures remain distinguishable", async () => {
  action.mockRejectedValueOnce(Error("UNAUTHORIZED"));
  expect((await POST(request())).status).toBe(401);
  action.mockRejectedValueOnce(Error("Disconnected"));
  expect((await POST(request())).status).toBe(503);
});
test("invalid slug is refused before contacting Convex", async () => {
  expect((await POST(request({}, ""))).status).toBe(400);
  expect(action).not.toHaveBeenCalled();
});
