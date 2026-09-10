import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

/** Точка фотографии, вокруг которой кадрировать. Доли от ширины и высоты. */
export type ImageFocus = { x: number; y: number };

/**
 * По умолчанию кадр смещён вверх, а не по центру: на фотографиях людей головы
 * почти всегда в верхней трети, и центрированная обрезка их срезает.
 * Значение подобрано как компромисс для контейнеров от 48 до 420 px высотой.
 */
export const DEFAULT_FOCUS: ImageFocus = { x: 0.5, y: 0.3 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Читает точку из metadata материала. Мусор и отсутствие значения дают умолчание. */
export function parseFocus(raw: unknown): ImageFocus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { x, y } = raw as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x: clamp(x), y: clamp(y) };
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
  style,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  alt: string;
  focus?: ImageFocus;
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

  const merged: CSSProperties = { objectPosition: focusPosition(focus), ...style };
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={merged}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
