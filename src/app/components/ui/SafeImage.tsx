import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

/**
 * Картинка, которая не ломает вёрстку. Если файл не отдался (внешний хостинг
 * удалил фото, загрузка не дошла до тома, адрес пустой), вместо значка битого
 * изображения показывается нейтральная заглушка в тех же габаритах.
 */
export default function SafeImage({
  src,
  alt,
  className = "",
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { src?: string; alt: string }) {
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

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
}
