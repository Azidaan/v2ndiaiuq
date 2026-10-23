import type { KeyboardEvent, MouseEvent } from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import type { PhotoFit } from "../../lib/inlinePhotoPresentation";

export type InlinePhotoFocus = { src: string; x: number; y: number; caption: string; fit: PhotoFit; zoom: number; cropped: boolean };
const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Every control addresses its own photo; it does not depend on the editor's selection. */
export default function InlinePhotoFocusPanel({ photos, disabled, onChange, onSizeChange, onRestore }: {
  photos: InlinePhotoFocus[];
  disabled: boolean;
  onChange: (index: number, x: number, y: number) => void;
  onSizeChange: (index: number, fit: PhotoFit, zoom: number) => void;
  onRestore: (index: number) => void;
}) {
  function pick(index: number, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) return; // Keyboard activation must not use the synthetic (0, 0) coordinates.
    const image = event.currentTarget.querySelector("img");
    if (!image) return;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    onChange(index, Math.round(clamp((event.clientX - rect.left) * 100 / rect.width)),
      Math.round(clamp((event.clientY - rect.top) * 100 / rect.height)));
  }
  function nudge(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2], Home: [0, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const photo = photos[index];
    onChange(index, event.key === "Home" ? 50 : clamp(photo.x + move[0]), event.key === "Home" ? 50 : clamp(photo.y + move[1]));
  }
  if (!photos.length) return null;
  return <details open className="border-t border-border bg-secondary/30 p-3">
    <summary className="cursor-pointer text-xs font-semibold text-foreground">Настройки каждой фотографии ({photos.length})</summary>
    <p className="mt-2 text-xs text-muted-foreground">Нажмите на важное место на миниатюре. Ниже выберите вид и масштаб. «Целиком» при 100% показывает весь снимок. Настройки сохраняются вместе с новостью.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo, index) => <div key={`${index}:${photo.src}`} className="min-w-0 rounded border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold"><Crosshair size={13} aria-hidden="true" /> Фото {index + 1}</span>
          <button type="button" disabled={disabled} aria-label={`Сбросить точку фокуса фото ${index + 1}`} onClick={() => onChange(index, 50, 50)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"><RotateCcw size={12} aria-hidden="true" /> В центр</button>
        </div>
        <button type="button" disabled={disabled}
          aria-label={`Точка фокуса фото ${index + 1}: ${photo.x}% по горизонтали, ${photo.y}% по вертикали`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => pick(index, event)} onKeyDown={(event) => nudge(index, event)}
          className="relative block w-fit max-w-full cursor-crosshair overflow-hidden rounded focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">
          <img src={photo.src} alt="" draggable={false} className="block h-auto max-h-[180px] w-auto max-w-full" />
          <span aria-hidden="true" style={{ left: `${photo.x}%`, top: `${photo.y}%` }} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent/70 p-1.5 shadow-[0_0_0_1px_rgba(0,0,0,.45)]" />
        </button>
        <p className="mt-2 truncate text-[11px] text-muted-foreground" title={photo.caption || undefined}>{photo.caption || `Фото ${index + 1}`} · {photo.x}% × {photo.y}%</p>
        <label className="mt-3 flex items-center gap-2 text-xs">Вид:
          <select aria-label={`Вид фото ${index + 1}`} disabled={disabled} value={photo.fit}
            onChange={(event) => onSizeChange(index, event.target.value as PhotoFit, 100)}
            className="min-w-0 flex-1 rounded border border-border bg-card p-1.5">
            <option value="original">Исходные пропорции</option>
            <option value="contain">Целиком в рамке</option>
            <option value="cover">Заполнить рамку</option>
          </select>
        </label>
        <label className="mt-3 block text-xs">Масштаб: {photo.zoom}%
          <input type="range" min="50" max="200" step="5" value={photo.zoom} disabled={disabled}
            aria-label={`Масштаб фото ${index + 1}`}
            onChange={(event) => onSizeChange(index, photo.fit === "original" ? "contain" : photo.fit, Number(event.target.value))}
            className="mt-1 block w-full accent-accent" />
        </label>
        {photo.fit !== "original" && <div className="mt-2 aspect-[4/3] overflow-hidden rounded bg-secondary" aria-label={`Предпросмотр фото ${index + 1}`}>
          <img src={photo.src} alt="" className="block h-full w-full" style={{ objectFit: photo.fit, objectPosition: `${photo.x}% ${photo.y}%`, transform: `scale(${photo.zoom / 100})`, transformOrigin: `${photo.x}% ${photo.y}%` }} />
        </div>}
        <button type="button" disabled={disabled} onClick={() => onSizeChange(index, "contain", 100)} className="mt-2 text-[11px] text-accent hover:underline">Показать целиком · 100%</button>
        {photo.cropped && <button type="button" disabled={disabled} onClick={() => onRestore(index)} className="mt-2 block text-[11px] text-accent hover:underline">Вернуть исходное фото без обрезки</button>}
      </div>)}
    </div>
  </details>;
}
