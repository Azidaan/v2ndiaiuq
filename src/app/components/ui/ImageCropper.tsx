import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { CropFormat } from "../../lib/imageCrops";

const FRAME_MAX_WIDTH = 460;
const FRAME_MAX_HEIGHT = 340;
const ZOOM_STEP = 1.15;
const MAX_ZOOM_OVER_COVER = 6;

type View = { zoom: number; x: number; y: number };

/** Минимальный масштаб, при котором картинка полностью закрывает рамку. */
function coverZoom(frame: { w: number; h: number }, natural: { w: number; h: number }) {
  if (!natural.w || !natural.h) return 1;
  return Math.max(frame.w / natural.w, frame.h / natural.h);
}

/** Не даём вытащить картинку за края рамки: пустых полей быть не должно. */
function clampView(view: View, frame: { w: number; h: number }, natural: { w: number; h: number }): View {
  const min = coverZoom(frame, natural);
  const zoom = Math.min(Math.max(view.zoom, min), min * MAX_ZOOM_OVER_COVER);
  const shownWidth = natural.w * zoom;
  const shownHeight = natural.h * zoom;
  return {
    zoom,
    x: Math.min(0, Math.max(frame.w - shownWidth, view.x)),
    y: Math.min(0, Math.max(frame.h - shownHeight, view.y)),
  };
}

/**
 * Обрезка с рамкой фиксированной пропорции: картинку двигают мышью или пальцем
 * и масштабируют колесом. Что видно в рамке — то и попадёт в файл.
 * На выходе всегда точный размер формата, при необходимости с растяжением.
 */
export default function ImageCropper({
  src,
  format,
  onCancel,
  onApply,
  busy = false,
}: {
  src: string;
  format: CropFormat;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
  busy?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState("");

  // Рамка занимает доступную ширину, но сохраняет пропорцию формата.
  useLayoutEffect(() => {
    function measure() {
      const available = wrapRef.current?.clientWidth ?? FRAME_MAX_WIDTH;
      let w = Math.min(available, FRAME_MAX_WIDTH);
      let h = (w * format.height) / format.width;
      if (h > FRAME_MAX_HEIGHT) {
        h = FRAME_MAX_HEIGHT;
        w = (h * format.width) / format.height;
      }
      setFrame({ w: Math.round(w), h: Math.round(h) });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [format.width, format.height]);

  // Загружаем отдельный экземпляр: он же пойдёт в canvas при экспорте.
  useEffect(() => {
    setError("");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => {
      imageRef.current = null;
      setError("Не удалось загрузить изображение для обрезки.");
    };
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  // Стартовое положение: картинка вписана целиком по короткой стороне и по центру.
  useEffect(() => {
    if (!frame.w || !natural.w) return;
    const zoom = coverZoom(frame, natural);
    setView(clampView({
      zoom,
      x: (frame.w - natural.w * zoom) / 2,
      y: (frame.h - natural.h * zoom) / 2,
    }, frame, natural));
  }, [frame, natural]);

  const applyZoom = useCallback((factor: number, anchor?: { x: number; y: number }) => {
    setView((current) => {
      const point = anchor ?? { x: frame.w / 2, y: frame.h / 2 };
      const next = current.zoom * factor;
      // Держим точку под курсором на месте при изменении масштаба.
      const ratio = next / current.zoom;
      return clampView({
        zoom: next,
        x: point.x - (point.x - current.x) * ratio,
        y: point.y - (point.y - current.y) * ratio,
      }, frame, natural);
    });
  }, [frame, natural]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y };
  }
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setView((current) => clampView({
      zoom: current.zoom,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }, frame, natural));
  }
  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function fitWhole() {
    // «Вписать целиком» невозможно без пустых полей, поэтому возвращаем
    // минимальный масштаб покрытия и центрируем — максимум видимого кадра.
    if (!frame.w || !natural.w) return;
    const zoom = coverZoom(frame, natural);
    setView(clampView({ zoom, x: (frame.w - natural.w * zoom) / 2, y: (frame.h - natural.h * zoom) / 2 }, frame, natural));
  }

  function exportCrop() {
    const image = imageRef.current;
    if (!image || !frame.w) return;
    // Область исходника, попавшая в рамку, пересчитанная в пиксели оригинала.
    const sx = -view.x / view.zoom;
    const sy = -view.y / view.zoom;
    const sw = frame.w / view.zoom;
    const sh = frame.h / view.zoom;
    const canvas = document.createElement("canvas");
    canvas.width = format.width;
    canvas.height = format.height;
    const context = canvas.getContext("2d");
    if (!context) return setError("Браузер не дал холст для обрезки.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, format.width, format.height);
    try {
      canvas.toBlob((blob) => {
        if (!blob) return setError("Не удалось подготовить файл.");
        onApply(blob);
      }, "image/jpeg", 0.88);
    } catch {
      setError("Изображение с другого сайта нельзя обрезать. Загрузите файл в CMS.");
    }
  }

  const minZoom = coverZoom(frame, natural);
  const zoomPercent = minZoom ? Math.round((view.zoom / minZoom) * 100) : 100;
  const upscaled = natural.w > 0 && (format.width / (frame.w / view.zoom)) > 1.02;

  return (
    <div ref={wrapRef}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <b className="text-sm text-primary">{format.label}</b>
        <span className="text-xs text-muted-foreground">{format.width}×{format.height} · {format.hint}</span>
      </div>

      {error ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">{error}</p>
      ) : (
        <>
          <div
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              applyZoom(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            style={{ width: frame.w, height: frame.h, touchAction: "none" }}
            className="relative select-none overflow-hidden rounded border-2 border-accent bg-[repeating-conic-gradient(#e8edf5_0%_25%,#f7f9fc_0%_50%)] bg-[length:16px_16px]"
            role="application"
            aria-label={`Область обрезки ${format.width} на ${format.height}. Перетащите изображение, колесо мыши меняет масштаб.`}
          >
            {natural.w > 0 && (
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: view.x,
                  top: view.y,
                  width: natural.w * view.zoom,
                  height: natural.h * view.zoom,
                  maxWidth: "none",
                  cursor: busy ? "progress" : "grab",
                }}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => applyZoom(1 / ZOOM_STEP)} aria-label="Уменьшить" className="rounded border border-border p-1.5 hover:border-accent">
              <Minus size={14} aria-hidden="true" />
            </button>
            <input
              type="range"
              min={100}
              max={MAX_ZOOM_OVER_COVER * 100}
              value={zoomPercent}
              aria-label="Масштаб"
              onChange={(event) => {
                const target = (Number(event.target.value) / 100) * minZoom;
                setView((current) => clampView({ ...current, zoom: target }, frame, natural));
              }}
              className="h-1 flex-1 min-w-[120px] accent-[var(--primary)]"
            />
            <button type="button" onClick={() => applyZoom(ZOOM_STEP)} aria-label="Увеличить" className="rounded border border-border p-1.5 hover:border-accent">
              <Plus size={14} aria-hidden="true" />
            </button>
            <button type="button" onClick={fitWhole} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:border-accent">
              <Maximize2 size={13} aria-hidden="true" /> Сбросить
            </button>
          </div>

          {upscaled && (
            <p className="mt-2 text-[11px] text-amber-700">
              Выбранный участок меньше {format.width}×{format.height}, файл будет растянут — возможна потеря чёткости.
              Исходник: {natural.w}×{natural.h}.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={exportCrop}
              disabled={busy || !natural.w}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Сохраняем..." : "Применить обрезку"}
            </button>
            <button type="button" onClick={onCancel} disabled={busy} className="rounded border border-border px-4 py-2 text-sm hover:border-accent disabled:opacity-50">
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
}
