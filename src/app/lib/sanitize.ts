import DOMPurify from "dompurify";

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    "p", "div", "br", "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li", "a", "h2", "h3", "h4", "blockquote", "figure", "figcaption", "img",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "data-focus", "data-original", "data-gallery", "data-image-block", "data-fit", "data-zoom", "data-photo-frame"],
  ALLOW_DATA_ATTR: false,
};

/** Каталог, куда складывает файлы обработчик загрузки CMS. */
const UPLOADS_PREFIX = "/uploads/";

let hookInstalled = false;
function installHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  // Разрешаем только свои загруженные файлы. Иначе редактор смог бы вставить
  // картинку с чужого сервера, и та превратилась бы в счётчик посещений.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element)) return;
    if (node.hasAttribute("data-photo-frame") && (node.tagName !== "DIV" || node.getAttribute("data-photo-frame") !== "true")) node.removeAttribute("data-photo-frame");
    if (node.hasAttribute("data-fit") && (node.tagName !== "IMG" || !/^(contain|cover)$/.test(node.getAttribute("data-fit") ?? ""))) node.removeAttribute("data-fit");
    if (node.hasAttribute("data-zoom")) {
      const zoom = Number(node.getAttribute("data-zoom"));
      if (node.tagName !== "IMG" || !Number.isFinite(zoom) || zoom < 50 || zoom > 200) node.removeAttribute("data-zoom");
    }
    if (node.hasAttribute("data-gallery") && (node.tagName !== "DIV" || !/^[1-4]$/.test(node.getAttribute("data-gallery") ?? ""))) node.removeAttribute("data-gallery");
    if (node.hasAttribute("data-image-block") && (node.tagName !== "FIGURE" || node.getAttribute("data-image-block") !== "true")) node.removeAttribute("data-image-block");
    if (node.tagName !== "IMG") return;
    const src = node.getAttribute("src") ?? "";
    if (!src.startsWith(UPLOADS_PREFIX) || src.includes("..")) return node.remove();
    const original = node.getAttribute("data-original");
    if (original && (!original.startsWith(UPLOADS_PREFIX) || original.includes(".."))) {
      node.removeAttribute("data-original");
    }
  });
}

export function sanitizeHtml(value: string) {
  installHook();
  return DOMPurify.sanitize(value, SANITIZE_OPTIONS);
}

export function htmlToPlainText(value: string) {
  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(value);
  return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** Точка фокуса картинки в тексте, записанная как data-focus="50 30". */
export function parseInlineFocus(value: string | null): { x: number; y: number } | null {
  if (!value) return null;
  const [x, y] = value.split(/\s+/).map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}
