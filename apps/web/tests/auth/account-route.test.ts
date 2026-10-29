import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../../app/api/account/route";
describe("account session bridge", () => {
  test("requires a session without exposing private values", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3002/api/account"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
  });
  test("cross-origin mutations are rejected before parsing or backend access", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3002/api/account", {
        method: "POST",
        headers: {
          origin: "https://other.example",
          cookie: "nook-session=private-test-token",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("private-test-token");
  });
  test("cross-site reads are rejected", async () => {
    expect(
      (
        await GET(
          new NextRequest("http://localhost:3002/api/account", {
            headers: { "sec-fetch-site": "cross-site" },
          }),
        )
      ).status,
    ).toBe(403);
  });
});
