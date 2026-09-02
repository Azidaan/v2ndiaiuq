import DOMPurify from "dompurify";

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ["p", "div", "br", "strong", "b", "em", "i", "u", "s", "strike", "ul", "ol", "li", "a", "h2", "h3", "h4", "blockquote"],
  ALLOWED_ATTR: ["href", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(value: string) {
  return DOMPurify.sanitize(value, SANITIZE_OPTIONS);
}

export function htmlToPlainText(value: string) {
  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(value);
  return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
