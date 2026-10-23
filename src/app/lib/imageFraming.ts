import type { CSSProperties } from "react";

export type ImageGeometry = { width: number; height: number; naturalWidth: number; naturalHeight: number };
export type Framing = { x: number; y: number; fit?: "contain" | "cover"; zoom?: number };

/** Scale the entire source. Only the outer frame clips it, never the image's own box. */
export function imageFramingStyle(framing: Framing, geometry?: ImageGeometry): CSSProperties {
  const position = `${Math.min(1, Math.max(0, framing.x)) * 100}% ${Math.min(1, Math.max(0, framing.y)) * 100}%`;
  const known = framing.zoom !== undefined && geometry && geometry.width > 0 && geometry.height > 0 && geometry.naturalWidth > 0 && geometry.naturalHeight > 0;
  let scale = (framing.zoom ?? 100) / 100;
  if (known && framing.fit !== "contain") {
    const sourceRatio = geometry.naturalWidth / geometry.naturalHeight;
    const frameRatio = geometry.width / geometry.height;
    scale *= Math.max(sourceRatio / frameRatio, frameRatio / sourceRatio);
  }
  return {
    objectFit: known ? "contain" : framing.fit ?? "cover",
    objectPosition: position,
    transform: known || framing.zoom !== undefined ? `scale(${scale})` : undefined,
    transformOrigin: position,
  };
}

export function imageGeometry(image: HTMLImageElement): ImageGeometry {
  return { width: image.clientWidth, height: image.clientHeight, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight };
}
