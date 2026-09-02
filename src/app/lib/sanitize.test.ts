// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("HTML sanitizer", () => {
  it("removes scripts, event handlers and unsupported elements", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)"><p onclick="alert(2)">Безопасный текст</p><script>alert(3)</script>');
    expect(result).toContain("<p>Безопасный текст</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("<img");
  });

  it("removes javascript URLs", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">Ссылка</a>')).toBe("<a>Ссылка</a>");
  });
});
