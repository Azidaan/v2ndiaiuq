// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { insertImageRow, addBeside, removeImageBlock, separateImageRow } from "./imageBlocks";
import { sanitizeHtml } from "./sanitize";
describe("image blocks", () => {
  it("inserts between paragraphs when a block is dropped at their boundary", () => {
    const editor = document.createElement("div"); editor.innerHTML = "<p>До</p><p>После</p>";
    const range = document.createRange(); range.setStart(editor, 1); range.collapse(true);
    insertImageRow(editor, range);
    expect([...editor.children].map((e) => e.tagName)).toEqual(["P", "DIV", "P"]);
    expect(editor.lastChild?.textContent).toBe("После");
  });
  it("splits a paragraph at the cursor without losing formatted text", () => {
    const editor = document.createElement("div"); editor.innerHTML = '<p>Начало <b>конец</b></p>';
    const range = document.createRange(); range.setStart(editor.firstChild!.firstChild!, 7); range.collapse(true);
    insertImageRow(editor, range);
    expect(editor.children[0].textContent).toBe("Начало ");
    expect(editor.children[1].getAttribute("data-gallery")).toBe("1");
    expect(editor.children[2].innerHTML).toBe("<b>конец</b>");
  });
  it("keeps row layout through sanitization, separation and deletion", () => {
    const editor = document.createElement("div"); const range = document.createRange(); range.selectNodeContents(editor);
    const first = insertImageRow(editor, range); first.innerHTML = '<img src="/uploads/a.jpg">';
    const second = addBeside(first); second.innerHTML = '<img src="/uploads/b.jpg">';
    expect(sanitizeHtml(editor.innerHTML)).toContain('data-gallery="2"');
    separateImageRow(second); expect(editor.querySelectorAll("[data-gallery]")).toHaveLength(2);
    removeImageBlock(first); expect(editor.querySelectorAll("[data-gallery]")).toHaveLength(1);
    expect(editor.querySelector("img")?.getAttribute("src")).toBe("/uploads/b.jpg");
  });
  it("rejects arbitrary row attributes and retains image restrictions", () => {
    const html = sanitizeHtml('<div data-gallery="999" style="position:fixed"><figure data-image-block="evil"><img src="https://external.test/a.jpg"></figure></div>');
    expect(html).not.toContain("data-gallery"); expect(html).not.toContain("data-image-block"); expect(html).not.toContain("style"); expect(html).not.toContain("<img");
  });
});
