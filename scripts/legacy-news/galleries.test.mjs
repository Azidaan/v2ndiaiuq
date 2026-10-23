import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { migrateGalleries } from "./galleries.mjs";
describe("legacy hover galleries", () => {
  it("groups cards horizontally and drops hover labels without losing article text", () => {
    const dom = new JSDOM('<main><p>Основной текст</p><div><h4>Скрытый фон</h4><a href="old.html#foto"><img src="/uploads/a.jpg"></a></div><br><a name="foto"></a><div><h4>Скрытый фон</h4><img src="/uploads/b.jpg"></div><p>После галереи</p></main>');
    const content = dom.window.document.querySelector("main");
    expect(migrateGalleries(content)).toBe(2);
    expect(content.querySelector('[data-gallery="2"]')?.querySelectorAll("figure")).toHaveLength(2);
    expect(content.textContent).toBe("Основной текстПосле галереи");
    expect(content.querySelectorAll("img")).toHaveLength(2);
    expect(migrateGalleries(content)).toBe(0);
    dom.window.close();
  });
});
