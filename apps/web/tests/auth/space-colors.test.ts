import { test, expect } from "vitest";
import {
  spaceTileStyle,
  luminance,
  SPACE_COLORS,
} from "../../features/spaces/utils/space-colors";
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("presets and sampled custom colors keep at least 4.5:1 icon contrast", () => {
  const colors: string[] = SPACE_COLORS.map((c) => c.value);
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17)
        colors.push(
          "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join(""),
        );
  for (const bg of colors) {
    const style = spaceTileStyle(bg);
    expect(contrast(style.background, style.color), bg).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});
test("black and light backgrounds use appropriate ink and malformed colors fall back", () => {
  expect(spaceTileStyle("#000000").color).toBe("#ffffff");
  expect(spaceTileStyle("#ffffff").color).toBe("#000000");
  expect(spaceTileStyle("url(evil)")).toEqual(spaceTileStyle());
});
