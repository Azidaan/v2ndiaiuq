import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import FramedImage from "./FramedImage";
import { imageFramingStyle } from "../../lib/imageFraming";

/** Точка фотографии, вокруг которой кадрировать. Доли от ширины и высоты. */
export type ImageSlot = "slider" | "article" | "card" | "tile";
export type ImageFraming = { x: number; y: number; fit?: "contain" | "cover"; zoom?: number };
export type ImageFocus = ImageFraming & { variants?: Partial<Record<ImageSlot, ImageFraming>> };

/**
 * По умолчанию кадр смещён вверх, а не по центру: на фотографиях людей головы
 * почти всегда в верхней трети, и центрированная обрезка их срезает.
 * Значение подобрано как компромисс для контейнеров от 48 до 420 px высотой.
 */
export const DEFAULT_FOCUS: ImageFocus = { x: 0.5, y: 0.3 };
/** Saved explicitly only for a new image; existing articles retain their framing. */
export const NEW_IMAGE_FOCUS: ImageFocus = { x: 0.5, y: 0.5, fit: "contain", zoom: 100 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Читает точку из metadata материала. Мусор и отсутствие значения дают умолчание. */
export function parseFocus(raw: unknown): ImageFocus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { x, y } = raw as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const result: ImageFocus = { x: clamp(x), y: clamp(y) };
  const record = raw as Record<string, unknown>;
  if (record.fit === "contain" || record.fit === "cover") result.fit = record.fit;
  if (typeof record.zoom === "number" && Number.isFinite(record.zoom)) result.zoom = Math.min(200, Math.max(50, record.zoom));
  if (record.variants && typeof record.variants === "object") {
    for (const slot of ["slider", "article", "card", "tile"] as const) {
      const variant = (record.variants as Record<string, unknown>)[slot];
      if (!variant || typeof variant !== "object") continue;
      const data = variant as Record<string, unknown>;
      if (typeof data.x !== "number" || typeof data.y !== "number" || !Number.isFinite(data.x) || !Number.isFinite(data.y)) continue;
      const framing: ImageFraming = { x: clamp(data.x), y: clamp(data.y) };
      if (data.fit === "contain" || data.fit === "cover") framing.fit = data.fit;
      if (typeof data.zoom === "number" && Number.isFinite(data.zoom)) framing.zoom = Math.min(200, Math.max(50, data.zoom));
      (result.variants ??= {})[slot] = framing;
    }
  }
  return result;
}

export function resolveFraming(focus?: ImageFocus, slot?: ImageSlot): ImageFraming {
  const framing = (slot && focus?.variants?.[slot]) || focus || DEFAULT_FOCUS;
  return { ...framing, fit: framing.fit ?? (slot === "tile" ? "contain" : "cover") };
}

export function framingStyle(focus?: ImageFocus, slot?: ImageSlot): CSSProperties {
  return imageFramingStyle(resolveFraming(focus, slot));
}

export function focusPosition(focus?: ImageFocus): string {
  const point = focus ?? DEFAULT_FOCUS;
  return `${(clamp(point.x) * 100).toFixed(1)}% ${(clamp(point.y) * 100).toFixed(1)}%`;
}

/**
 * Картинка, которая не ломает вёрстку. Если файл не отдался (внешний хостинг
 * удалил фото, загрузка не дошла до тома, адрес пустой), вместо значка битого
 * изображения показывается нейтральная заглушка в тех же габаритах.
 *
 * Один и тот же файл выводится на сайте в восьми разных пропорциях, поэтому
 * кадрирование задаётся точкой фокуса, а не обрезкой файла: обрезать под все
 * пропорции сразу невозможно.
 */
export default function SafeImage({
  src,
  alt,
  className = "",
  focus,
  slot,
  style,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  alt: string;
  focus?: ImageFocus;
  slot?: ImageSlot;
}) {
  const [failed, setFailed] = useState(false);

  // Смена адреса — повод попробовать снова: прежняя ошибка к новому файлу не относится.
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-secondary text-muted-foreground ${className}`}
      >
        <ImageOff size={22} aria-hidden="true" />
      </span>
    );
  }

  return (
    <FramedImage
      src={src}
      alt={alt}
      className={className}
      framing={resolveFraming(focus, slot)}
      style={style}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
