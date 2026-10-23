// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import ImageFocusPicker from "./ImageFocusPicker";
import SafeImage, { framingStyle, parseFocus, type ImageFocus } from "./SafeImage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe("independent cover frames", () => {
  it("changes only one placement, preserves it after JSON storage, and applies the matching public frame", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    let saved: ImageFocus | undefined;
    function Form() {
      const [focus, setFocus] = useState<ImageFocus | undefined>({ x: .5, y: .3 });
      return <ImageFocusPicker src="/uploads/a.jpg" focus={focus} onChange={(next) => { saved = next; setFocus(next); }} />;
    }
    try {
      await act(async () => root.render(<Form />));
      const fit = host.querySelector<HTMLSelectElement>('select[aria-label="Вид обложки: Лента новостей"]')!;
      await act(async () => { fit.value = "contain"; fit.dispatchEvent(new Event("change", { bubbles: true })); });
      const focusButton = host.querySelector<HTMLButtonElement>('button[aria-label="Точка кадрирования: Слайдер"]')!;
      await act(async () => { focusButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
      const restored = parseFocus(JSON.parse(JSON.stringify(saved)));
      expect(restored?.variants?.slider?.x).toBe(.52);
      expect(restored?.variants?.tile).toEqual({ x: .5, y: .3, fit: "contain", zoom: 100 });
      expect(framingStyle(restored, "article").objectFit).toBe("cover");
      await act(async () => root.render(<><SafeImage src="/uploads/a.jpg" alt="tile" slot="tile" focus={restored} /><SafeImage src="/uploads/a.jpg" alt="slider" slot="slider" focus={restored} /></>));
      expect(host.querySelector<HTMLImageElement>('img[alt="tile"]')?.style.objectFit).toBe("contain");
      expect(host.querySelector<HTMLImageElement>('img[alt="slider"]')?.style.objectPosition).toBe("52% 30%");
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
  it("retains legacy points and rejects invalid variants and scales", () => {
    expect(parseFocus({ x: .2, y: .4 })).toEqual({ x: .2, y: .4 });
    const focus = parseFocus({ x: .5, y: .3, variants: { tile: { x: 2, y: -1, zoom: 999, fit: "contain" }, card: { x: "bad", y: .5 } } });
    expect(focus?.variants?.tile).toEqual({ x: 1, y: 0, zoom: 200, fit: "contain" });
    expect(focus?.variants?.card).toBeUndefined();
    expect(framingStyle(focus, "tile").transform).toBe("scale(2)");
  });
  it("uses the entire source at 80% in both admin preview and public image after loading", async () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    const focus: ImageFocus = { x: .5, y: .5, variants: { slider: { x: .5, y: .5, fit: "cover", zoom: 80 } } };
    try {
      await act(async () => root.render(<><ImageFocusPicker src="/uploads/a.jpg" focus={focus} onChange={() => {}} /><SafeImage src="/uploads/a.jpg" alt="public" focus={focus} slot="slider" /></>));
      const images = [host.querySelector<HTMLImageElement>('[aria-label="Предпросмотр обложки: Слайдер"] img')!, host.querySelector<HTMLImageElement>('img[alt="public"]')!];
      await act(async () => {
        for (const image of images) {
          for (const [key, value] of Object.entries({ clientWidth: 200, clientHeight: 200, naturalWidth: 1000, naturalHeight: 500 })) Object.defineProperty(image, key, { value, configurable: true });
          image.dispatchEvent(new Event("load"));
        }
      });
      for (const image of images) {
        expect(image.style.objectFit).toBe("contain");
        expect(image.style.transform).toBe("scale(1.6)");
        expect(image.style.objectPosition).toBe("50% 50%");
      }
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});
