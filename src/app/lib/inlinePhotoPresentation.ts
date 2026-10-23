import { parseInlineFocus } from "./sanitize";
import { imageFramingStyle, imageGeometry } from "./imageFraming";

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
    Object.assign(image.style, imageFramingStyle({ x: focus.x / 100, y: focus.y / 100, fit, zoom: photoZoom(image) }, imageGeometry(image)));
  }
}

/** Recalculate from the source when it loads or the responsive frame changes size. */
export function observeInlinePhotoPresentation(root: HTMLElement) {
  const update = () => applyInlinePhotoPresentation(root);
  root.addEventListener("load", update, true);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  observer?.observe(root);
  for (const image of root.querySelectorAll("img")) observer?.observe(image);
  return () => { root.removeEventListener("load", update, true); observer?.disconnect(); };
}
