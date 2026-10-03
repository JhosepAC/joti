// H1 regression: the OAuth `state` MAC comparison must actually compare both
// buffers. Pure unit test (Web Crypto runs natively under Node).
import { describe, expect, test } from "vitest";
import { createSignedState, verifySignedState } from "../../convex/auth/_oauthShared";

describe("oauth state MAC", () => {
  test("a freshly minted state verifies", async () => {
    const state = await createSignedState();
    await expect(verifySignedState(state)).resolves.toBe(true);
  });

  test("a tampered MAC is rejected", async () => {
    const state = await createSignedState();
    const [nonce, mac] = state.split(".") as [string, string];
    const tamperedMac = mac.slice(0, -1) + (mac.endsWith("A") ? "B" : "A");
    await expect(verifySignedState(`${nonce}.${tamperedMac}`)).resolves.toBe(false);
  });

  test("a tampered nonce is rejected", async () => {
    const state = await createSignedState();
    const [, mac] = state.split(".") as [string, string];
    await expect(verifySignedState(`AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.${mac}`)).resolves.toBe(
      false,
    );
  });

  test("malformed states are rejected without throwing", async () => {
    await expect(verifySignedState("")).resolves.toBe(false);
    await expect(verifySignedState("no-separator")).resolves.toBe(false);
    await expect(verifySignedState("a.b.c")).resolves.toBe(false);
    await expect(verifySignedState("!!!.???")).resolves.toBe(false);
    await expect(verifySignedState("short.x")).resolves.toBe(false);
  });
});
