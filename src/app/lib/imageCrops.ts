/**
 * Форматы изображений на сайте. Ширина и высота — точный размер файла, который
 * сохраняется после обрезки. На экране слот тянется по ширине, но пропорция
 * зафиксирована, поэтому кадр везде показывается одинаково.
 */
export type CropFormatId = "hero" | "tile" | "article";

export type CropFormat = {
  id: CropFormatId;
  label: string;
  hint: string;
  width: number;
  height: number;
};

export const CROP_FORMATS: CropFormat[] = [
  { id: "hero", label: "Слайдер на главной", hint: "Широкий баннер рядом с текстом новости", width: 600, height: 280 },
  { id: "tile", label: "Плитка новостей", hint: "Небольшой квадрат в ленте под слайдером", width: 120, height: 120 },
  { id: "article", label: "Внутри новости", hint: "Крупная картинка над текстом материала", width: 940, height: 480 },
];

export const CROP_FORMAT_BY_ID: Record<CropFormatId, CropFormat> = Object.fromEntries(
  CROP_FORMATS.map((format) => [format.id, format]),
) as Record<CropFormatId, CropFormat>;

/** Адреса обрезанных файлов, разложенные по форматам. Лежат в metadata.crops. */
export type CropUrls = Partial<Record<CropFormatId, string>>;

export function parseCrops(raw: unknown): CropUrls {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const result: CropUrls = {};
  for (const format of CROP_FORMATS) {
    const value = source[format.id];
    if (typeof value === "string" && value.trim()) result[format.id] = value;
  }
  return result;
}

/** Обрезанный файл нужного формата, иначе оригинал. */
export function pickCrop(crops: CropUrls, format: CropFormatId, original?: string) {
  return crops[format] ?? original;
}

/** Пропорция для CSS aspect-ratio: слот тянется по ширине, кадр не меняется. */
export function aspectRatio(format: CropFormatId) {
  const { width, height } = CROP_FORMAT_BY_ID[format];
  return `${width} / ${height}`;
}
