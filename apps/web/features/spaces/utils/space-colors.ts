/** WCAG relative luminance; choose the stronger contrast for a vector icon. */
export function luminance(hex: string): number {
  const values = [1, 3, 5].map((start) => {
    const s = parseInt(hex.slice(start, start + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
export function spaceTileStyle(background?: string) {
  const color =
    background && /^#[0-9a-f]{6}$/i.test(background) ? background : "#dfe5ed";
  const l = luminance(color),
    dark = 0;
  const darkContrast = (l + 0.05) / (dark + 0.05),
    lightContrast = 1.05 / (l + 0.05);
  return {
    background: color,
    color: darkContrast >= lightContrast ? "#000000" : "#ffffff",
  };
}
export const SPACE_COLORS = [
  { key: "default", value: "" },
  { key: "blue", value: "#d3e3fd" },
  { key: "green", value: "#ceead6" },
  { key: "pink", value: "#fce8e6" },
  { key: "yellow", value: "#feefc3" },
  { key: "gray", value: "#e8eaed" },
  { key: "navy", value: "#183a46" },
  { key: "graphite", value: "#202124" },
  { key: "black", value: "#000000" },
] as const;
