import { describe, expect, it } from "vitest";
import { contourY, snapNodesToContours } from "./neuralContours";

describe("nodes on the background contours", () => {
  it("matches known Bezier points across repeated tiles, including the left edge", () => {
    // Independent midpoint fixtures for the two cubic segments of the drawn contour.
    expect(contourY(189.625)).toBeCloseTo(9, 8);
    expect(contourY(570.375)).toBeCloseTo(3, 8);
    expect(contourY(380)).toBeCloseTo(12, 8);
    expect(contourY(949.625)).toBeCloseTo(9, 8);
    expect(contourY(-570.375)).toBeCloseTo(9, 8);
    expect(contourY(0)).toBeCloseTo(contourY(760), 8);
  });

  it("keeps the horizontal positions and snaps to the same lines after page offsets", () => {
    const nodes = snapNodesToContours([[136.75, 7], [517.5, 33]], [812.875, 563.25]);
    expect(nodes[0][0]).toBe(136.75);
    expect(nodes[0][1]).toBeCloseTo(5.75, 8);
    expect(nodes[1][0]).toBe(517.5);
    expect(nodes[1][1]).toBeCloseTo(27.75, 8);
    for (const [i, originalY] of [7, 33].entries()) expect(Math.abs(nodes[i][1] - originalY)).toBeLessThanOrEqual(14);
  });
});
