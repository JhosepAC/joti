type Hsv = { h: number; s: number; v: number };

export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const v = Math.max(r, g, b);
  const chroma = v - Math.min(r, g, b);
  if (!chroma) return { h: 0, s: 0, v };

  let sector: number;
  if (v === r) sector = (g - b) / chroma;
  else if (v === g) sector = 2 + (b - r) / chroma;
  else sector = 4 + (r - g) / chroma;
  return { h: (sector * 60 + 360) % 360, s: chroma / v, v };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (offset: number) => {
    const sector = (offset + h / 60) % 6;
    const factor = Math.max(0, Math.min(sector, 4 - sector, 1));
    return Math.round(255 * v * (1 - s * factor))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}
