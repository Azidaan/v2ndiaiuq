import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

const NODES = [
  [22, 115], [62, 45], [88, 165], [126, 92], [166, 32],
  [180, 150], [222, 75], [265, 130], [290, 40],
] as const;
const EDGES = [[0, 1], [0, 2], [0, 3], [1, 3], [1, 4], [2, 3], [2, 5], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [6, 8], [7, 8]];
const SIGNALS = [[0, 3, 6, 8], [2, 5, 7], [1, 4, 6, 7]];
const COOLDOWN = 3500;
const DURATION = 2600;
// Content and controls never activate the decoration underneath them.
const CONTENT = "a, button, input, textarea, select, label, article, aside, nav, [role='dialog'], .bg-card, .bg-white, .bg-secondary, .prose, h1, h2, h3, p, li, table, img, video, iframe";

function Network() {
  return <>
    <g fill="none" stroke="currentColor" strokeWidth="1">
      {EDGES.map(([a, b]) => <path key={`${a}-${b}`} d={`M${NODES[a].join(",")} L${NODES[b].join(",")}`} />)}
    </g>
    <g fill="var(--background)" stroke="currentColor" strokeWidth="1.2">
      {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 3 || i === 6 ? 3.5 : 2.5} />)}
    </g>
  </>;
}

/** Sparse SVG decoration: one short response to the mouse, with no idle animation loop. */
export default function NeuralBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const patternId = useId();
  const [pulse, setPulse] = useState<{ x: number; y: number }>();

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let last = -Infinity;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function clear() {
      clearTimeout(timer);
      setPulse(undefined);
    }
    function move(event: PointerEvent) {
      if (!media.matches || event.pointerType === "touch" || Date.now() - last < COOLDOWN) return;
      if (!(event.target instanceof Element) || event.target.closest(CONTENT)) return;
      const rect = parent!.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
      last = Date.now();
      setPulse({ x, y });
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
  }, []);

  return <div ref={ref} className="neural-background" aria-hidden="true">
    <svg className="neural-background-pattern" width="100%" height="100%" focusable="false">
      <defs>
        <pattern id={patternId} width="490" height="440" patternUnits="userSpaceOnUse">
          <g transform="translate(-75 55)"><Network /></g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
    {pulse && <svg data-neural-pulse="" className="neural-background-pulse" viewBox="0 0 320 210" width="320" height="210"
      style={{ left: pulse.x - 160, top: pulse.y - 105 }} focusable="false">
      <g className="neural-background-glow"><Network /></g>
      {SIGNALS.map((route, i) => <path key={i} className="neural-background-signal" pathLength="1"
        d={route.map((n, j) => `${j ? "L" : "M"}${NODES[n].join(",")}`).join(" ")}
        style={{ "--signal-delay": `${i * 180}ms` } as CSSProperties} />)}
      {NODES.map(([x, y], i) => <circle key={i} className="neural-background-node" cx={x} cy={y} r="3"
        style={{ "--signal-delay": `${i * 85}ms` } as CSSProperties} />)}
    </svg>}
  </div>;
}
