// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("картинки в размеченном тексте", () => {
  it("оставляет загруженные в CMS файлы", () => {
    const result = sanitizeHtml('<p>текст</p><img src="/uploads/news/a.jpg" alt="фото" data-focus="50 20">');
    expect(result).toContain('src="/uploads/news/a.jpg"');
    expect(result).toContain('data-focus="50 20"');
  });

  it("вырезает картинки с чужого домена", () => {
    expect(sanitizeHtml('<img src="https://example.com/evil.png" alt="">')).not.toContain("example.com");
  });

  it("вырезает data-адреса", () => {
    expect(sanitizeHtml('<img src="data:image/svg+xml;base64,AAAA" alt="">')).not.toContain("data:image");
  });

  it("вырезает выход за пределы каталога загрузок", () => {
    expect(sanitizeHtml('<img src="/uploads/../secret.jpg" alt="">')).not.toContain("secret");
  });

  it("снимает обработчики событий", () => {
    expect(sanitizeHtml('<img src="/uploads/a.jpg" onerror="alert(1)">')).not.toContain("onerror");
  });

  it("по-прежнему вырезает скрипты", () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script>')).not.toContain("script");
  });
});

describe("ссылка на оригинал у обрезанной картинки", () => {
  it("сохраняется, если указывает на загруженный файл", () => {
    const result = sanitizeHtml('<img src="/uploads/inline/crop.jpg" alt="" data-original="/uploads/inline/full.jpg">');
    expect(result).toContain('data-original="/uploads/inline/full.jpg"');
  });

  it("снимается, если ведёт на чужой домен", () => {
    const result = sanitizeHtml('<img src="/uploads/inline/crop.jpg" alt="" data-original="https://example.com/a.jpg">');
    expect(result).toContain('src="/uploads/inline/crop.jpg"');
    expect(result).not.toContain("example.com");
  });

  it("снимается при выходе за пределы каталога", () => {
    const result = sanitizeHtml('<img src="/uploads/inline/crop.jpg" alt="" data-original="/uploads/../etc/passwd">');
    expect(result).not.toContain("passwd");
  });
});
