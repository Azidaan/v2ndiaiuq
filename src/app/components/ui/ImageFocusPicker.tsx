import type { KeyboardEvent, MouseEvent } from "react";
import { DEFAULT_FOCUS, resolveFraming, type ImageFocus, type ImageFraming, type ImageSlot } from "./SafeImage";
import FramedImage from "./FramedImage";

const PREVIEWS: { slot: ImageSlot; label: string; ratio: string }[] = [
  { slot: "slider", label: "Слайдер", ratio: "600 / 280" },
  { slot: "article", label: "В новости", ratio: "940 / 480" },
  { slot: "card", label: "Карточка новости", ratio: "400 / 176" },
  { slot: "tile", label: "Лента новостей", ratio: "2 / 1" },
];
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function ImageFocusPicker({ src, focus, onChange }: {
  src: string; focus?: ImageFocus; onChange: (focus: ImageFocus | undefined) => void;
}) {
  function change(slot: ImageSlot, patch: Partial<ImageFraming>) {
    const current = focus ?? DEFAULT_FOCUS;
    const { variants: _, ...base } = current;
    onChange({ ...current, variants: { ...current.variants, [slot]: { ...(current.variants?.[slot] ?? base), ...patch } } });
  }
  function pick(slot: ImageSlot, event: MouseEvent<HTMLButtonElement>) {
    if (!event.detail) return;
    const rect = event.currentTarget.querySelector("img")!.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    change(slot, { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) });
  }
  function nudge(slot: ImageSlot, point: ImageFraming, event: KeyboardEvent<HTMLButtonElement>) {
    const move = ({ ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02], Home: [0, 0] } as Record<string, number[]>)[event.key];
    if (!move) return;
    event.preventDefault();
    change(slot, event.key === "Home" ? DEFAULT_FOCUS : { x: clamp(point.x + move[0]), y: clamp(point.y + move[1]) });
  }
  return <div className="mb-4 rounded border border-border bg-secondary/30 p-4">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-xs font-semibold">Обложка: отдельный кадр для каждого места</span>
      <button type="button" onClick={() => onChange(undefined)} className="text-xs text-muted-foreground hover:text-foreground">Сбросить все</button>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">У каждого вида своя точка и масштаб. «Целиком» при 100% показывает весь снимок; свободное место заполняется фоном. Сохраните новость, чтобы применить настройки.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PREVIEWS.map(({slot, label, ratio}) => {
        const point = focus?.variants?.[slot] ?? focus ?? DEFAULT_FOCUS;
        return <div key={slot} className="min-w-0 rounded border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold">{label}</p>
          <p className="mb-2 text-[11px] text-muted-foreground">1. Точка на исходном фото</p>
          <button type="button" aria-label={`Точка кадрирования: ${label}`} onClick={(event) => pick(slot, event)} onKeyDown={(event) => nudge(slot, point, event)}
            className="relative mx-auto block w-fit max-w-full cursor-crosshair overflow-hidden rounded focus-visible:outline-2 focus-visible:outline-accent">
            <img src={src} alt="" draggable={false} className="block h-auto max-h-[130px] w-auto max-w-full" />
            <span aria-hidden="true" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 shadow" />
          </button>
          <label className="mt-3 block text-xs">Вид
            <select aria-label={`Вид обложки: ${label}`} value={point.fit ?? (slot === "tile" ? "contain" : "cover")} onChange={(event) => change(slot, { fit: event.target.value as "cover" | "contain", zoom: 100 })} className="mt-1 block w-full rounded border border-border bg-card p-1.5">
              <option value="cover">Заполнить рамку</option><option value="contain">Целиком</option>
            </select>
          </label>
          <label className="mt-3 block text-xs">Масштаб: {point.zoom ?? 100}%
            <input type="range" min="50" max="200" step="5" aria-label={`Масштаб обложки: ${label}`} value={point.zoom ?? 100} onChange={(event) => change(slot, { zoom: Number(event.target.value) })} className="mt-1 block w-full accent-accent" />
          </label>
          <p className="mb-2 mt-3 text-[11px] font-semibold">2. Так будет выглядеть на сайте</p>
          <div aria-label={`Предпросмотр обложки: ${label}`} className="relative mt-3 overflow-hidden rounded bg-secondary" style={{ aspectRatio: ratio }}>
            <FramedImage src={src} alt="" className="absolute inset-0 block h-full w-full" framing={resolveFraming(focus, slot)} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{(point.fit ?? (slot === "tile" ? "contain" : "cover")) === "contain" && (point.zoom ?? 100) <= 100
            ? "Фото целиком. Точка меняет положение в свободном пространстве рамки."
            : "Кадр обновляется сразу. Если фото совпадает с рамкой по пропорциям, при 100% обрезки нет."}</p>
          <button type="button" onClick={() => change(slot, { fit: "contain", zoom: 100, x: .5, y: .5 })} className="mt-2 text-[11px] text-accent hover:underline">Показать целиком · 100%</button>
        </div>;
      })}
    </div>
  </div>;
}
