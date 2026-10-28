// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NeuralBackground from "./NeuralBackground";
import { contourY } from "../../lib/neuralContours";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function setup(enabled = true, home = false) {
  vi.useFakeTimers();
  const media = Object.assign(new EventTarget(), { matches: enabled });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<div data-surface="" className={home ? "site-shell--home" : undefined}><NeuralBackground contours={home} /><article>Текст новости</article><button>Ссылка</button></div>));
  const surface = host.querySelector<HTMLElement>("[data-surface]")!;
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 } as DOMRect);
  const move = async (target: Element = surface, pointerType = "mouse", position: readonly [number, number] = [40, 150]) => act(async () => {
    const event = new MouseEvent("pointermove", { bubbles: true, clientX: position[0], clientY: position[1] });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    target.dispatchEvent(event);
  });
  const close = async () => { await act(async () => root.unmount()); host.remove(); };
  return { host, media, move, close };
}

describe("neural background interaction", () => {
  it("shows idle artwork and highlights the same nodes when the pointer crosses it", async () => {
    const { host, move, close } = await setup(true, true);
    try {
      const idle = host.querySelector('[data-neural-art="mesh"]')!;
      expect(host.querySelectorAll('[data-neural-art]')).toHaveLength(4);
      expect(host.querySelector('[data-neural-pulse]')).toBeNull();
      await move(undefined, "mouse", [660, 100]);
      const pulse = host.querySelector<SVGSVGElement>('[data-neural-pulse]')!;
      expect(pulse.style.left).toBe("500px");
      expect(pulse.style.top).toBe("0px");
      expect(pulse.dataset.neuralShape).toBe("mesh");
      const idleCircles = [...idle.querySelectorAll('circle')];
      [...pulse.querySelectorAll('.neural-background-node')].forEach((circle, i) => {
        expect(circle.getAttribute('cx')).toBe(idleCircles[i].getAttribute('cx'));
        expect(circle.getAttribute('cy')).toBe(idleCircles[i].getAttribute('cy'));
      });
      await act(async () => vi.advanceTimersByTime(2600));
      expect(host.querySelector('[data-neural-pulse]')).toBeNull();
      expect(host.querySelectorAll('[data-neural-art]')).toHaveLength(4);
    } finally { await close(); }
  });

  it("alternates distinct network shapes while keeping every node on the background lines", async () => {
    const { host, move, close } = await setup(true, true);
    const shapes = new Set<string>();
    const drawings = new Set<string>();
    try {
      for (let i = 0; i < 4; i++) {
        await move();
        const pulse = host.querySelector<SVGSVGElement>("[data-neural-pulse]")!;
        shapes.add(pulse.dataset.neuralShape!);
        drawings.add([...pulse.querySelectorAll(".neural-background-glow path")].map(p => p.getAttribute("d")).join(" "));
        const originX = Number.parseFloat(pulse.style.left), originY = Number.parseFloat(pulse.style.top);
        for (const circle of pulse.querySelectorAll(".neural-background-node")) {
          const x = Number(circle.getAttribute("cx")) + originX;
          const y = Number(circle.getAttribute("cy")) + originY;
          const row = (y - contourY(x)) / 28;
          expect(row).toBeCloseTo(Math.round(row), 8);
        }
        await act(async () => vi.advanceTimersByTime(3500));
      }
      expect(shapes.size).toBe(4);
      expect(drawings.size).toBe(4);
    } finally { await close(); }
  });

  it("places the home pulse nodes exactly on contours and retains straight diagonal connections", async () => {
    const { host, move, close } = await setup(true, true);
    try {
      await move(undefined, "mouse", [327.625, 250]);
      const pulse = host.querySelector("[data-neural-pulse]")!;
      const node = pulse.querySelector(".neural-background-node")!;
      expect(Number(node.getAttribute("cx"))).toBe(22);
      // Absolute X=189.625 has curve Y=9; nearest row is Y=261, local Y=116.
      expect(Number(node.getAttribute("cy"))).toBeCloseTo(116, 8);
      expect(pulse.querySelectorAll(".neural-background-node")).toHaveLength(9);
      const connections = pulse.querySelectorAll(".neural-background-glow path");
      expect(connections).toHaveLength(16);
      for (const path of connections) {
        expect(path.getAttribute("d")).toContain("L");
        expect(path.getAttribute("d")).not.toMatch(/[CQ]/);
      }
    } finally { await close(); }
  });

  it("shows a brief pulse only on the background and limits repeated mouse movement", async () => {
    const { host, move, close } = await setup();
    try {
      await move(host.querySelector("article")!);
      await move(host.querySelector("button")!);
      await move(undefined, "touch");
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
      await move();
      expect(host.querySelector("[data-neural-pulse]")).not.toBeNull();
      await act(async () => vi.advanceTimersByTime(2600));
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
      await move();
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
      await act(async () => vi.advanceTimersByTime(900));
      await move();
      expect(host.querySelector("[data-neural-pulse]")).not.toBeNull();
    } finally { await close(); }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not animate when hover or motion is disabled, including changes while open", async () => {
    const { host, media, move, close } = await setup(false);
    try {
      await move();
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
      media.matches = true;
      await move();
      expect(host.querySelector("[data-neural-pulse]")).not.toBeNull();
      await act(async () => { media.matches = false; media.dispatchEvent(new Event("change")); });
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
      await act(async () => vi.advanceTimersByTime(4000));
      await move();
      expect(host.querySelector("[data-neural-pulse]")).toBeNull();
    } finally { await close(); }
    expect(vi.getTimerCount()).toBe(0);
  });
});
