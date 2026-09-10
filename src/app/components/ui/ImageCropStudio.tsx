import { useState } from "react";
import { Crop, Check, Trash2 } from "lucide-react";
import ImageCropper from "./ImageCropper";
import { CROP_FORMATS, type CropFormatId, type CropUrls } from "../../lib/imageCrops";
import { fileStorage } from "../../lib/fileStorage";

/**
 * Обрезка исходной фотографии под каждый формат сайта. Оригинал остаётся в
 * image_url и не меняется, поэтому обрезку можно переделать в любой момент.
 * Готовые файлы складываются в metadata.crops по идентификатору формата.
 */
export default function ImageCropStudio({
  src,
  crops,
  onChange,
}: {
  src: string;
  crops: CropUrls;
  onChange: (crops: CropUrls) => void;
}) {
  const [active, setActive] = useState<CropFormatId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(formatId: CropFormatId, blob: Blob) {
    setBusy(true);
    setError("");
    try {
      const file = new File([blob], `crop-${formatId}-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = await fileStorage.upload("crops", file);
      onChange({ ...crops, [formatId]: url });
      setActive(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить обрезанный файл");
    } finally {
      setBusy(false);
    }
  }

  function drop(formatId: CropFormatId) {
    const next = { ...crops };
    delete next[formatId];
    onChange(next);
  }

  const activeFormat = CROP_FORMATS.find((format) => format.id === active);

  return (
    <div className="mb-4 rounded border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Crop size={14} aria-hidden="true" /> Обрезка под форматы сайта
      </div>

      {activeFormat ? (
        <ImageCropper
          src={src}
          format={activeFormat}
          busy={busy}
          onCancel={() => setActive(null)}
          onApply={(blob) => void save(activeFormat.id, blob)}
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Одна фотография показывается в трёх пропорциях. Обрежьте каждую отдельно —
            рамку можно двигать и масштабировать. Пока обрезки нет, берётся оригинал.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CROP_FORMATS.map((format) => {
              const url = crops[format.id];
              return (
                <div key={format.id} className="rounded border border-border bg-card p-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <b className="text-xs text-primary">{format.label}</b>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{format.width}×{format.height}</span>
                  </div>
                  <div
                    style={{ aspectRatio: `${format.width} / ${format.height}` }}
                    className="mb-2 w-full overflow-hidden rounded border border-border bg-secondary"
                  >
                    <img src={url ?? src} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] ${url ? "text-green-700" : "text-muted-foreground"}`}>
                      {url ? <><Check size={11} aria-hidden="true" /> обрезано</> : "оригинал"}
                    </span>
                    <span className="flex gap-1">
                      {url && (
                        <button
                          type="button"
                          onClick={() => drop(format.id)}
                          title="Убрать обрезку"
                          className="rounded p-1 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActive(format.id)}
                        className="rounded border border-accent px-2 py-1 text-[11px] text-accent hover:bg-accent hover:text-accent-foreground"
                      >
                        {url ? "Переобрезать" : "Обрезать"}
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}
