export async function readIconResponse(response: Response) {
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) > 2 * 1024 * 1024
  )
    throw Error("INVALID_IMAGE");
  const reader = response.body?.getReader();
  if (!reader) throw Error("INVALID_IMAGE");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2 * 1024 * 1024) {
      await reader.cancel();
      throw Error("INVALID_IMAGE");
    }
    chunks.push(new Uint8Array(value));
  }
  return new File(chunks, "icon", {
    type: response.headers.get("content-type") ?? "image/webp",
  });
}
export async function prepareSpaceIcon(file: File) {
  if (file.size > 2 * 1024 * 1024) throw Error("INVALID_IMAGE");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16_000_000) throw Error("INVALID_IMAGE");
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (!blob || blob.size > 128 * 1024) throw Error("INVALID_IMAGE");
    return new File([blob], "space-icon.webp", { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
