import { parseInlineFocus } from "./sanitize";

export type PhotoFit = "original" | "contain" | "cover";
export function photoFit(image: Element): PhotoFit {
  const fit = image.getAttribute("data-fit");
  return fit === "contain" || fit === "cover" ? fit : "original";
}
export function photoZoom(image: Element) {
  const zoom = Number(image.getAttribute("data-zoom") ?? 100);
  return Number.isFinite(zoom) ? Math.min(200, Math.max(50, zoom)) : 100;
}

/** Rebuild presentation after sanitizing; arbitrary inline styles are never stored. */
export function applyInlinePhotoPresentation(root: HTMLElement) {
  for (const image of root.querySelectorAll<HTMLImageElement>("img")) {
    const focus = parseInlineFocus(image.getAttribute("data-focus")) ?? { x: 50, y: 50 };
    image.style.objectPosition = `${focus.x}% ${focus.y}%`;
    const fit = photoFit(image);
    let frame = image.parentElement?.hasAttribute("data-photo-frame") ? image.parentElement : null;
    if (fit === "original") {
      if (frame) { frame.before(image); frame.remove(); }
      image.style.removeProperty("object-fit");
      image.style.removeProperty("transform");
      image.style.removeProperty("transform-origin");
      continue;
    }
    if (!frame) {
      frame = image.ownerDocument.createElement("div");
      frame.setAttribute("data-photo-frame", "true");
      image.before(frame); frame.append(image);
    }
    image.style.objectFit = fit;
    image.style.transform = `scale(${photoZoom(image) / 100})`;
    image.style.transformOrigin = `${focus.x}% ${focus.y}%`;
  }
}
