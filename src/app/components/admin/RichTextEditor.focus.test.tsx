// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import RichTextEditor from "./RichTextEditor";
import SafeHtml from "../SafeHtml";
import { sanitizeHtml } from "../../lib/sanitize";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const initial = '<div data-gallery="2"><figure data-image-block="true"><img src="/uploads/a.jpg" data-focus="20 30"></figure><figure data-image-block="true"><img src="/uploads/b.jpg" data-focus="70 80"></figure></div>';
let saved = "";
async function mount(value = initial) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  function Form() {
    const [html, setHtml] = useState(value);
    return <RichTextEditor value={html} onChange={(next) => { saved = next; setHtml(next); }} />;
  }
  await act(async () => { root.render(<Form />); });
}
const photos = () => [...host.querySelectorAll<HTMLImageElement>(".admin-editor-content img")];
const pickers = () => [...host.querySelectorAll<HTMLButtonElement>('button[aria-label^="Точка фокуса фото"]')];
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); });

describe("independent photo focus controls", () => {
  it("changes a photo without selecting it and retains both points after save/reopen", async () => {
    await mount();
    expect(pickers()).toHaveLength(2);
    expect(host.querySelectorAll('[aria-label^="Предпросмотр фото"]')).toHaveLength(2);
    await act(async () => { pickers()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    expect(photos().map((img) => img.getAttribute("data-focus"))).toEqual(["20 30", "72 80"]);
    expect(host.querySelector<HTMLImageElement>('[aria-label="Предпросмотр фото 2"] img')?.style.objectPosition).toBe("72% 80%");
    await act(async () => { pickers()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(photos().map((img) => img.getAttribute("data-focus"))).toEqual(["20 32", "72 80"]);
    const persisted = saved;
    await act(async () => root.unmount()); host.remove();
    await mount(persisted);
    expect(photos().map((img) => img.getAttribute("data-focus"))).toEqual(["20 32", "72 80"]);
    expect(pickers()[1].getAttribute("aria-label")).toContain("72%");
  });
  it("resets only its own point and keeps it attached to the image when reordered", async () => {
    await mount();
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Сбросить точку фокуса фото 1"]')!.click(); });
    expect(photos().map((img) => img.getAttribute("data-focus"))).toEqual(["50 50", "70 80"]);
    await act(async () => { photos()[1].dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const move = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Левее"))!;
    await act(async () => move.click());
    expect(photos().map((img) => [img.getAttribute("src"), img.getAttribute("data-focus")])).toEqual([
      ["/uploads/b.jpg", "70 80"], ["/uploads/a.jpg", "50 50"],
    ]);
    expect(pickers()[0].getAttribute("aria-label")).toContain("70%");
  });
  it("keeps each photo's fit and zoom after editing and renders the same frame publicly", async () => {
    await mount(initial.replace('data-focus="20 30"', 'data-focus="20 30" data-fit="cover" data-zoom="150"'));
    expect(photos()[0].style.transform).toBe("scale(1.5)");
    expect(photos()[1].parentElement?.hasAttribute("data-photo-frame")).toBe(false);
    const fit = host.querySelector<HTMLSelectElement>('select[aria-label="Вид фото 2"]')!;
    await act(async () => { fit.value = "contain"; fit.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(photos().map((img) => [img.getAttribute("data-fit"), img.getAttribute("data-zoom")])).toEqual([["cover", "150"], ["contain", "100"]]);
    const persisted = saved;
    await act(async () => root.unmount()); host.remove();
    await mount(persisted);
    expect(photos()[0].style.transform).toBe("scale(1.5)");
    expect(photos()[1].style.objectFit).toBe("contain");
    await act(async () => { root.render(<SafeHtml html={persisted} />); });
    const publicPhotos = [...host.querySelectorAll<HTMLImageElement>("img")];
    expect(publicPhotos[0].style.transform).toBe("scale(1.5)");
    expect(publicPhotos[0].style.objectPosition).toBe("20% 30%");
    expect(publicPhotos[1].style.objectFit).toBe("contain");
    expect(host.querySelectorAll('[data-photo-frame="true"]')).toHaveLength(2);
  });
  it("restores an uncropped original and resets only that photo's zoom", async () => {
    await mount(initial.replace('src="/uploads/a.jpg"', 'src="/uploads/crop.jpg" data-original="/uploads/a.jpg" data-fit="cover" data-zoom="200"'));
    const restore = [...host.querySelectorAll("button")].find((b) => b.textContent === "Вернуть исходное фото без обрезки")!;
    await act(async () => restore.click());
    expect(photos()[0].getAttribute("src")).toBe("/uploads/a.jpg");
    expect(photos()[0].style.objectFit).toBe("contain");
    expect(photos()[0].getAttribute("data-zoom")).toBe("100");
    expect(photos()[1].getAttribute("data-focus")).toBe("70 80");
    const fit = host.querySelector<HTMLSelectElement>('select[aria-label="Вид фото 1"]')!;
    await act(async () => { fit.value = "original"; fit.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(photos()[0].parentElement?.hasAttribute("data-photo-frame")).toBe(false);
    expect(photos()[0].style.transform).toBe("");
  });
  it("rejects invalid presentation attributes and arbitrary styles", () => {
    const clean = sanitizeHtml('<div data-photo-frame="wrong"><img src="/uploads/a.jpg" data-fit="evil" data-zoom="999" style="position:fixed"></div>');
    expect(clean).not.toMatch(/data-fit|data-zoom|data-photo-frame|style=/);
  });
  it("recalculates inline source scaling after the original file loads", async () => {
    await mount(initial.replace('data-focus="20 30"', 'data-focus="20 30" data-fit="cover" data-zoom="80"'));
    const image = photos()[0];
    await act(async () => {
      for (const [key, value] of Object.entries({ clientWidth: 200, clientHeight: 200, naturalWidth: 1000, naturalHeight: 500 })) Object.defineProperty(image, key, { value, configurable: true });
      image.dispatchEvent(new Event("load"));
    });
    expect(image.style.objectFit).toBe("contain");
    expect(image.style.transform).toBe("scale(1.6)");
    expect(image.style.transformOrigin).toBe("20% 30%");
    expect(photos()[1].style.transform).toBe("");
  });
});
