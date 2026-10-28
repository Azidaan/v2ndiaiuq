import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CONTOUR_HEIGHT, CONTOUR_SPACING, CONTOUR_WIDTH, contourPath, snapNodesToContours, type NeuralPoint } from "../../lib/neuralContours";

type NeuralPattern = {
  name: string;
  nodes: readonly NeuralPoint[];
  edges: readonly (readonly [number, number])[];
  signals: readonly (readonly number[])[];
};
const PATTERNS: readonly NeuralPattern[] = [
  {
    name: "mesh",
    nodes: [[22, 115], [62, 45], [88, 165], [126, 92], [166, 32], [180, 150], [222, 75], [265, 130], [290, 40]],
    edges: [[0, 1], [0, 2], [0, 3], [1, 3], [1, 4], [2, 3], [2, 5], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [6, 8], [7, 8]],
    signals: [[0, 3, 6, 8], [2, 5, 7], [1, 4, 6, 7]],
  },
  {
    name: "branches",
    nodes: [[20, 150], [70, 110], [125, 80], [180, 50], [245, 25], [180, 130], [245, 170], [95, 180], [270, 100]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [1, 7], [5, 8]],
    signals: [[0, 1, 2, 3, 4], [0, 1, 2, 5, 6], [7, 1, 2, 5, 8]],
  },
  {
    name: "chain",
    nodes: [[18, 140], [55, 65], [95, 125], [130, 40], [165, 105], [200, 170], [235, 95], [275, 145], [300, 50]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
    signals: [[0, 1, 2, 3, 4], [2, 3, 4, 5, 6], [4, 5, 6, 7, 8]],
  },
  {
    name: "layers",
    nodes: [[30, 40], [30, 105], [30, 170], [150, 30], [150, 100], [150, 180], [285, 65], [285, 150]],
    edges: [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [3, 6], [3, 7], [4, 6], [4, 7], [5, 6], [5, 7]],
    signals: [[0, 3, 6], [1, 4, 7], [2, 5, 7]],
  },
];
const COOLDOWN = 3500;
const DURATION = 2600;
const ART_WIDTH = CONTOUR_WIDTH * 2;
const ART_HEIGHT = CONTOUR_HEIGHT * 2;
const ART_ORIGINS: readonly NeuralPoint[] = [[500, 0], [-90, 300], [1160, 240], [580, 700]];

function artwork(pattern: NeuralPattern, origin: NeuralPoint, contours: boolean) {
  return { pattern, nodes: contours ? snapNodesToContours(pattern.nodes, origin) : pattern.nodes, x: origin[0] + 160, y: origin[1] + 105 };
}

function artworkAt(x: number, y: number, contours: boolean) {
  const col = Math.floor(x / ART_WIDTH), row = Math.floor(y / ART_HEIGHT);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const [i, [ox, oy]] of ART_ORIGINS.entries()) {
      const left = ox + (col + dx) * ART_WIDTH, top = oy + (row + dy) * ART_HEIGHT;
      if (x >= left && x <= left + 320 && y >= top && y <= top + 210) return artwork(PATTERNS[i], [left, top], contours);
    }
  }
}
// Content and controls never activate the decoration underneath them.
const CONTENT = "a, button, input, textarea, select, label, article, aside, nav, [role='dialog'], .bg-card, .bg-white, .bg-secondary, .prose, h1, h2, h3, p, li, table, img, video, iframe";

function Network({ pattern = PATTERNS[0], nodes = pattern.nodes }: { pattern?: NeuralPattern; nodes?: readonly NeuralPoint[] }) {
  return <>
    <g fill="none" stroke="currentColor" strokeWidth="1">
      {pattern.edges.map(([a, b]) => <path key={`${a}-${b}`} d={`M${nodes[a].join(",")} L${nodes[b].join(",")}`} />)}
    </g>
    <g fill="var(--background)" stroke="currentColor" strokeWidth="1.2">
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 || i === 6 ? 3.5 : 2.5} />)}
    </g>
  </>;
}

/** Sparse SVG decoration: one short response to the mouse, with no idle animation loop. */
export default function NeuralBackground({ contours = false }: { contours?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const patternId = useId();
  const contourId = useId();
  const [pulse, setPulse] = useState<{ x: number; y: number; pattern: NeuralPattern; nodes: readonly NeuralPoint[] }>();

  useEffect(() => {
    setPulse(undefined);
    const parent = ref.current?.parentElement;
    if (!parent || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let last = -Infinity;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function clear() {
      clearTimeout(timer);
      setPulse(undefined);
    }
    function move(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(".institute-banner")) {
        clear();
        return;
      }
      if (!media.matches || event.pointerType === "touch" || Date.now() - last < COOLDOWN) return;
      if (!(event.target instanceof Element) || event.target.closest(CONTENT)) return;
      const rect = parent!.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      last = Date.now();
      const existing = artworkAt(x, y, contours);
      setPulse(existing ?? artwork(PATTERNS[sequence++ % PATTERNS.length], [x - 160, y - 105], contours));
      timer = setTimeout(() => setPulse(undefined), DURATION);
    }
    parent.addEventListener("pointermove", move, { passive: true });
    parent.addEventListener("pointerleave", clear);
    media.addEventListener("change", clear);
    return () => {
      clearTimeout(timer);
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", clear);
      media.removeEventListener("change", clear);
    };
  }, [contours]);

  return <div ref={ref} className="neural-background" aria-hidden="true">
    <svg className="neural-background-contours" width="100%" height="100%" focusable="false">
      <defs>
        <pattern id={contourId} width={CONTOUR_WIDTH} height={CONTOUR_HEIGHT} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.7">
            {Array.from({ length: 26 }, (_, i) => {
              return <path key={i} d={contourPath((i - 3) * CONTOUR_SPACING)} />;
            })}
          </g>
          <path d="M0 250 C126 206,253 314,380 262 S634 294,760 250" fill="none" stroke="var(--primary)" strokeWidth="0.8" strokeDasharray="3 7" />
          <g fill="var(--home-copper, currentColor)"><circle cx="171" cy="254.5" r="3" /><circle cx="470" cy="244.5" r="3" /></g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${contourId})`} />
    </svg>
    <svg className="neural-background-pattern" width="100%" height="100%" focusable="false">
      <defs>
        <pattern id={patternId} width={ART_WIDTH} height={ART_HEIGHT} patternUnits="userSpaceOnUse">
          {ART_ORIGINS.map((origin, i) => <g key={i} data-neural-art={PATTERNS[i].name} transform={`translate(${origin.join(" ")})`}>
            <Network pattern={PATTERNS[i]} nodes={artwork(PATTERNS[i], origin, contours).nodes} />
          </g>)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
    {pulse && <svg data-neural-pulse="" data-neural-shape={pulse.pattern.name} className="neural-background-pulse" viewBox="0 0 320 210" width="320" height="210"
      style={{ left: pulse.x - 160, top: pulse.y - 105 }} focusable="false">
      <g className="neural-background-glow"><Network pattern={pulse.pattern} nodes={pulse.nodes} /></g>
      {pulse.pattern.signals.map((route, i) => <path key={i} className="neural-background-signal" pathLength="1"
        d={route.map((n, j) => `${j ? "L" : "M"}${pulse.nodes[n].join(",")}`).join(" ")}
        style={{ "--signal-delay": `${i * 180}ms` } as CSSProperties} />)}
      {pulse.nodes.map(([x, y], i) => <circle key={i} className="neural-background-node" cx={x} cy={y} r="3"
        style={{ "--signal-delay": `${i * 85}ms` } as CSSProperties} />)}
    </svg>}
  </div>;
}
