export type NeuralPoint = readonly [number, number];
type Cubic = readonly [NeuralPoint, NeuralPoint, NeuralPoint, NeuralPoint];

export const CONTOUR_WIDTH = 760;
export const CONTOUR_HEIGHT = 560;
export const CONTOUR_SPACING = 28;
// The background and node placement share the same two cubic Bezier segments.
const SEGMENTS: readonly Cubic[] = [
  [[0, 0], [126, -44], [253, 64], [380, 12]],
  [[380, 12], [507, -40], [634, 44], [760, 0]],
];

export function contourPath(baseY: number): string {
  return `M0 ${baseY} ` + SEGMENTS.map(([, a, b, c]) =>
    `C${a[0]} ${a[1] + baseY},${b[0]} ${b[1] + baseY},${c[0]} ${c[1] + baseY}`
  ).join(" ");
}

function cubicAt(a: number, b: number, c: number, d: number, t: number): number {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
}

export function contourY(x: number): number {
  const localX = ((x % CONTOUR_WIDTH) + CONTOUR_WIDTH) % CONTOUR_WIDTH;
  const [a, b, c, d] = SEGMENTS[localX <= 380 ? 0 : 1];
  let low = 0, high = 1;
  // X is strictly increasing, so inversion gives the exact point on the SVG curve.
  for (let i = 0; i < 36; i++) {
    const t = (low + high) / 2;
    if (cubicAt(a[0], b[0], c[0], d[0], t) < localX) low = t;
    else high = t;
  }
  return cubicAt(a[1], b[1], c[1], d[1], (low + high) / 2);
}

export function snapNodesToContours(nodes: readonly NeuralPoint[], origin: NeuralPoint): NeuralPoint[] {
  return nodes.map(([x, y]) => {
    const offset = contourY(origin[0] + x);
    const row = Math.round((origin[1] + y - offset) / CONTOUR_SPACING);
    return [x, row * CONTOUR_SPACING + offset - origin[1]];
  });
}
