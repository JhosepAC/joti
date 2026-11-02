"use node";
import sharp from "sharp";
import { MAX_FILE_BYTES, MAX_PIXELS } from "./model";
import { sniff } from "./sniff";
export { sniff } from "./sniff";
// Only DateTimeOriginal/DateTime are read. GPS and other EXIF stay in the private original.
export function captureDate(exif?: Buffer) {
  if (!exif) return undefined;
  try {
    const start = exif.subarray(0, 6).toString("ascii") === "Exif\0\0" ? 6 : 0;
    const le = exif.toString("ascii", start, start + 2) === "II";
    const u16 = (p: number) =>
      le ? exif.readUInt16LE(start + p) : exif.readUInt16BE(start + p);
    const u32 = (p: number) =>
      le ? exif.readUInt32LE(start + p) : exif.readUInt32BE(start + p);
    if (u16(2) !== 42) return;
    let date: string | undefined;
    const read = (offset: number, depth = 0) => {
      if (depth > 1) return;
      const count = Math.min(u16(offset), 256);
      for (let n = 0; n < count; n++) {
        const p = offset + 2 + n * 12,
          tag = u16(p),
          type = u16(p + 2),
          len = u32(p + 4);
        if (tag === 0x8769) read(u32(p + 8), depth + 1);
        if (
          [0x9003, 0x132].includes(tag) &&
          type === 2 &&
          len >= 19 &&
          len <= 32
        ) {
          const at = u32(p + 8);
          const value = exif.toString("ascii", start + at, start + at + 19);
          if (tag === 0x9003 || !date) date = value;
        }
      }
    };
    read(u32(4));
    if (!date) return;
    const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
      date,
    );
    if (!match) return;
    // EXIF commonly lacks an offset. Preserve calendar date consistently as UTC, without inventing a location.
    const parts = match.slice(1).map(Number),
      d = new Date(
        Date.UTC(
          parts[0]!,
          parts[1]! - 1,
          parts[2]!,
          parts[3]!,
          parts[4]!,
          parts[5]!,
        ),
      );
    if (parts[3]! > 23 || parts[4]! > 59 || parts[5]! > 59) return;
    if (
      d.getUTCFullYear() !== parts[0] ||
      d.getUTCMonth() !== parts[1]! - 1 ||
      d.getUTCDate() !== parts[2] ||
      d.getTime() > Date.now() + 86400000 ||
      d.getTime() < Date.UTC(1800, 0, 1)
    )
      return;
    return d.getTime();
  } catch {
    return undefined;
  }
}
export async function derive(input: Buffer) {
  const mime = sniff(input),
    factory = () =>
      sharp(input, {
        limitInputPixels: MAX_PIXELS,
        failOn: "warning",
        animated: false,
      });
  const metadata = await factory().metadata();
  if (
    (metadata.pages ?? 1) > 1 ||
    !metadata.width ||
    !metadata.height ||
    !["jpeg", "png", "webp", "heif", "avif"].includes(metadata.format ?? "")
  )
    throw Error("UNSUPPORTED_FORMAT");
  const variants: {
    name: "high" | "medium" | "thumb" | "placeholder";
    data: Buffer;
    width: number;
    height: number;
  }[] = [];
  for (const [name, size, quality] of [
    ["high", 3840, 93],
    ["medium", 1600, 88],
    ["thumb", 480, 85],
    ["placeholder", 24, 65],
  ] as const) {
    const render = (edge: number) =>
      factory()
        .autoOrient()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .withIccProfile("srgb")
        .webp({ quality, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
    let edge: number = size,
      out = await render(edge);
    // Keep quality high; reduce the display dimensions only for unusually heavy derivatives.
    while (out.data.length > MAX_FILE_BYTES && edge > 480) {
      edge = Math.round(edge * 0.8);
      out = await render(edge);
    }
    variants.push({
      name,
      data: out.data,
      width: out.info.width,
      height: out.info.height,
    });
  }
  return {
    mime,
    width: metadata.autoOrient.width,
    height: metadata.autoOrient.height,
    capturedAt: captureDate(metadata.exif),
    variants,
  };
}
