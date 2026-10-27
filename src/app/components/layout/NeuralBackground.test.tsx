// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NeuralBackground from "./NeuralBackground";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function setup(enabled = true) {
  vi.useFakeTimers();
  const media = Object.assign(new EventTarget(), { matches: enabled });
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<div data-surface=""><NeuralBackground /><article>Текст новости</article><button>Ссылка</button></div>));
  const surface = host.querySelector<HTMLElement>("[data-surface]")!;
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 800 } as DOMRect);
  const move = async (target: Element = surface, pointerType = "mouse") => act(async () => {
    const event = new MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 150 });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    target.dispatchEvent(event);
  });
  const close = async () => { await act(async () => root.unmount()); host.remove(); };
  return { host, media, move, close };
}

describe("neural background interaction", () => {
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
