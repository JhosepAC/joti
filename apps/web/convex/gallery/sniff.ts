import { MAX_FILE_BYTES } from "./model";
export function sniff(b: Uint8Array) {
  if (b.length < 12 || b.length > MAX_FILE_BYTES) throw Error("INVALID_IMAGE");
  const starts = (values: number[]) => values.every((v, n) => b[n] === v);
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...b.subarray(from, to));
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
  if (starts([255, 216, 255])) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (
    ascii(4, 8) === "ftyp" &&
    /avif|avis/.test(ascii(8, Math.min(b.length, 40)))
  )
    return "image/avif";
  throw Error("UNSUPPORTED_FORMAT");
}
