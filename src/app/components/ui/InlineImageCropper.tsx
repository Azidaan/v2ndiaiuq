import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Maximize, X } from "lucide-react";

const MAX_STAGE_WIDTH = 560;
const MAX_STAGE_HEIGHT = 360;
const MIN_SELECTION = 12;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Свободная обрезка картинки в тексте: пользователь обводит прямоугольник,
 * который надо оставить. Исходный файл не трогается — результат сохраняется
 * отдельным файлом, поэтому обрезку всегда можно переделать от оригинала.
 */
export default function InlineImageCropper({
  src,
  busy = false,
  onCancel,
  onApply,
}: {
  src: string;
  busy?: boolean;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageElRef = useRef<HTMLImageElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number } | null>(null);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setRect(null);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
      const scale = Math.min(MAX_STAGE_WIDTH / image.naturalWidth, MAX_STAGE_HEIGHT / image.naturalHeight, 1);
      setStage({ w: Math.round(image.naturalWidth * scale), h: Math.round(image.naturalHeight * scale) });
    };
    image.onerror = () => setError("Не удалось загрузить изображение.");
    image.src = src;
    return () => { image.onload = null; image.onerror = null; };
  }, [src]);

  function pointIn(event: ReactPointerEvent<HTMLDivElement>) {
    // Мерим по самой картинке: у холста есть рамка, и её толщина сдвигала бы
    // координаты, а вместе с ними и вырезаемую область.
    const bounds = (imageElRef.current ?? stageRef.current!).getBoundingClientRect();
    return {
      x: Math.min(bounds.width, Math.max(0, event.clientX - bounds.left)),
      y: Math.min(bounds.height, Math.max(0, event.clientY - bounds.top)),
    };
  }

  function startDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy || !stage.w) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointIn(event);
    dragRef.current = { id: event.pointerId, startX: point.x, startY: point.y };
    setRect({ x: point.x, y: point.y, w: 0, h: 0 });
  }
  function draw(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const point = pointIn(event);
    setRect({
      x: Math.min(drag.startX, point.x),
      y: Math.min(drag.startY, point.y),
      w: Math.abs(point.x - drag.startX),
      h: Math.abs(point.y - drag.startY),
    });
  }
  function endDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  }

  function selectAll() {
    const bounds = imageElRef.current?.getBoundingClientRect();
    setRect({ x: 0, y: 0, w: bounds?.width ?? stage.w, h: bounds?.height ?? stage.h });
  }

  // Пересчёт из экранных пикселей в пиксели оригинала — по фактической
  // отрисованной ширине картинки, а не по заявленному размеру холста.
  const shownWidth = imageElRef.current?.getBoundingClientRect().width || stage.w;
  const ratio = shownWidth ? natural.w / shownWidth : 1;
  const output = rect
    ? {
        w: Math.min(natural.w, Math.round(rect.w * ratio)),
        h: Math.min(natural.h, Math.round(rect.h * ratio)),
      }
    : null;
  const usable = !!rect && rect.w >= MIN_SELECTION && rect.h >= MIN_SELECTION;

  function apply() {
    const image = imageRef.current;
    if (!image || !rect || !usable || !output) return;
    const canvas = document.createElement("canvas");
    canvas.width = output.w;
    canvas.height = output.h;
    const context = canvas.getContext("2d");
    if (!context) return setError("Браузер не дал холст для обрезки.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, rect.x * ratio, rect.y * ratio, output.w, output.h, 0, 0, output.w, output.h);
    try {
      canvas.toBlob((blob) => {
        if (!blob) return setError("Не удалось подготовить файл.");
        onApply(blob);
      }, "image/jpeg", 0.9);
    } catch {
      setError("Картинку с другого сайта обрезать нельзя.");
    }
  }

  if (error) {
    return (
      <div className="border-b border-border bg-secondary/40 p-3">
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">{error}</p>
        <button type="button" onClick={onCancel} className="mt-2 rounded border border-border px-3 py-1.5 text-xs">Закрыть</button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-secondary/40 p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">Обрезка картинки</p>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Обведите прямоугольник, который надо оставить. Исходный файл не меняется — обрезанная копия сохраняется отдельно.
      </p>

      {/* Рамка вынесена наружу: если она на холсте, картинка рисуется на два
          пикселя уже заявленного размера, и выделение пересчитывается неверно. */}
      <div className="inline-block rounded border border-border bg-card">
      <div
        ref={stageRef}
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        style={{ width: stage.w || undefined, height: stage.h || undefined, touchAction: "none" }}
        className="relative select-none overflow-hidden"
        role="application"
        aria-label="Область обрезки: обведите прямоугольник указателем"
      >
        {stage.w > 0 && <img ref={imageElRef} src={src} alt="" draggable={false} className="block h-full w-full select-none" />}
        {rect && (
          <>
            {/* Затемняем четырьмя полосами вокруг выделения: надёжнее clip-path,
                который в этой связке не отрисовывался. */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 bg-black/50" style={{ height: rect.y }} />
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/50" style={{ top: rect.y + rect.h }} />
            <div className="pointer-events-none absolute left-0 bg-black/50" style={{ top: rect.y, height: rect.h, width: rect.x }} />
            <div className="pointer-events-none absolute right-0 bg-black/50" style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }} />
            <div
              className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.55)]"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          </>
        )}
      </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={selectAll} disabled={busy} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-[11px] hover:border-accent">
          <Maximize size={12} aria-hidden="true" /> Выделить всё
        </button>
        <span className="text-[11px] text-muted-foreground">
          {output && usable
            ? `Останется ${output.w}×${output.h} из ${natural.w}×${natural.h}`
            : `Исходник ${natural.w}×${natural.h}. Выделение не задано.`}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={busy || !usable}
          className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Check size={13} aria-hidden="true" /> {busy ? "Сохраняем..." : "Применить обрезку"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50">
          <X size={13} aria-hidden="true" /> Отмена
        </button>
      </div>
    </div>
  );
}
