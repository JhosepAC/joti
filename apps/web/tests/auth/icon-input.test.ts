import { test, expect } from "vitest";
import { readIconResponse } from "../../features/spaces/utils/prepare-icon";
test("icon downloads are bounded even without Content-Length and cancel oversized streams", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(2 * 1024 * 1024));
      c.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(readIconResponse(new Response(stream))).rejects.toThrow(
    "INVALID_IMAGE",
  );
  expect(cancelled).toBe(true);
  await expect(
    readIconResponse(
      new Response("x", {
        headers: { "Content-Length": String(3 * 1024 * 1024) },
      }),
    ),
  ).rejects.toThrow("INVALID_IMAGE");
  const file = await readIconResponse(
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "image/webp" },
    }),
  );
  expect(file.size).toBe(3);
  expect(file.type).toBe("image/webp");
});
