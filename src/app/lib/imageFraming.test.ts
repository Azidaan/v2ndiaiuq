import { describe, expect, it } from "vitest";
import { imageFramingStyle } from "./imageFraming";

describe("scaling the uncropped image", () => {
  const geometry = { width: 200, height: 200, naturalWidth: 1000, naturalHeight: 500 };
  const style = (zoom: number) => imageFramingStyle({ x: .5, y: .5, fit: "cover", zoom }, geometry);
  it("reveals original pixels outside the previous crop when zooming out", () => {
    expect(style(100).objectFit).toBe("contain");
    expect(style(100).transform).toBe("scale(2)");
    expect(style(80).transform).toBe("scale(1.6)");
    // The ribbon at source x=200 was outside the old x=250..750 crop.
    // At 80%, the original's visible interval is x=187.5..812.5.
    const ribbonOnScreen = (sourceX: number, scale: number) => (200 - 200 * scale) / 2 + sourceX * .2 * scale;
    expect(ribbonOnScreen(200, 2)).toBeLessThan(0);
    expect(ribbonOnScreen(200, 1.6)).toBeGreaterThan(0);
    expect(style(50).transform).toBe("scale(1)");
  });
  it("preserves contain sizing, off-centre focus, and portrait source proportions", () => {
    expect(imageFramingStyle({ x: 1, y: 0, fit: "contain", zoom: 80 }, geometry)).toMatchObject({ objectFit: "contain", transform: "scale(0.8)", objectPosition: "100% 0%", transformOrigin: "100% 0%" });
    expect(imageFramingStyle({ x: .5, y: .5, fit: "cover", zoom: 80 }, { width: 400, height: 200, naturalWidth: 500, naturalHeight: 1000 }).transform).toBe("scale(3.2)");
  });
});
