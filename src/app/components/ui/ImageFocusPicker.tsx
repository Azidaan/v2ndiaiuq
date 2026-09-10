import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import { DEFAULT_FOCUS, focusPosition, type ImageFocus } from "./SafeImage";

/**
 * Реальные пропорции слотов сайта. Высота у всех одинаковая, ширина считается
 * из пропорции — так видно, какая часть кадра уцелеет в каждом месте.
 */
const PREVIEW_HEIGHT = 70;
const PREVIEWS: { label: string; width: number; height: number }[] = [
  { label: "Слайдер 600×280", width: 600, height: 280 },
  { label: "В новости 940×480", width: 940, height: 480 },
  { label: "Карточка новости", width: 400, height: 176 },
  { label: "Плитка 120×120", width: 120, height: 120 },
];

const STEP = 0.02;

/**
 * Выбор точки кадрирования: редактор отмечает важное место на фотографии,
 * и все контейнеры сайта обрезают вокруг него. Обрезать сам файл нельзя —
 * одно фото показывается сразу в нескольких пропорциях.
 */
export default function ImageFocusPicker({
  src,
  focus,
  onChange,
}: {
  src: string;
  focus?: ImageFocus;
  onChange: (focus: ImageFocus | undefined) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const point = focus ?? DEFAULT_FOCUS;

  function pick(event: MouseEvent<HTMLDivElement>) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    onChange({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    });
  }

  function nudge(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange({
      x: Math.min(1, Math.max(0, point.x + move[0])),
      y: Math.min(1, Math.max(0, point.y + move[1])),
    });
  }

  return (
    <div className="mb-4 rounded border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Crosshair size={14} aria-hidden="true" /> Точка кадрирования
        </span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <RotateCcw size={13} aria-hidden="true" /> По умолчанию
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div
          ref={frameRef}
          role="application"
          tabIndex={0}
          aria-label={`Точка кадрирования: ${Math.round(point.x * 100)}% по горизонтали, ${Math.round(point.y * 100)}% по вертикали. Стрелки сдвигают точку.`}
          onClick={pick}
          onKeyDown={nudge}
          className="relative w-full max-w-[260px] shrink-0 cursor-crosshair overflow-hidden rounded border border-border bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={src} alt="" className="block max-h-[190px] w-full object-contain" />
          <span
            aria-hidden="true"
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          >
            <span className="block h-5 w-5 rounded-full border-2 border-white bg-accent/70 shadow-[0_0_0_1px_rgba(0,0,0,.45)]" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs text-muted-foreground">
            Нажмите на важное место фотографии — например на лицо. Все размеры на сайте
            будут обрезаться вокруг этой точки.
          </p>
          <div className="flex flex-wrap gap-3">
            {PREVIEWS.map((preview) => (
              <span key={preview.label} className="text-center">
                <span
                  style={{
                    height: PREVIEW_HEIGHT,
                    width: Math.round((PREVIEW_HEIGHT * preview.width) / preview.height),
                  }}
                  className="block overflow-hidden rounded border border-border bg-card"
                >
                  <img
                    src={src}
                    alt=""
                    style={{ objectPosition: focusPosition(focus) }}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{preview.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
