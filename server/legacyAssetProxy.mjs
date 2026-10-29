import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

/**
 * Показ без копирования файлов: для бесплатного хостинга без постоянного диска.
 * Картинки и документы перенесённых новостей лежат на старом сайте, а в
 * server/seeds/legacy-news перечислено, какой файл откуда. Если файла нет
 * в UPLOAD_DIR/legacy-news, сервер скачивает его со старого сайта, кладёт в
 * UPLOAD_DIR и отдаёт. Следующие запросы идут уже с диска.
 *
 * Включается LEGACY_ASSET_PROXY=true. Адрес берётся только из списков сидов,
 * произвольный адрес запросить нельзя.
 */
const PREFIX = "/uploads/legacy-news/";
const MAX_BYTES = 120 * 1024 * 1024;
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".pdf": "application/pdf", ".mp4": "video/mp4", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation" };

export async function createLegacyAssetProxy({ seedsDir, uploadsRoot, logger }) {
  const sources = new Map();                       // /uploads/legacy-news/имя → адрес на старом сайте
  for (const file of (await readdir(seedsDir)).filter((f) => /^news-.*\.json$/.test(f))) {
    const data = JSON.parse(await readFile(join(seedsDir, file), "utf8"));
    for (const { path, url } of data.assets ?? []) if (path.startsWith(PREFIX) && /^https?:\/\/guiaidn\.ru\//.test(url)) sources.set(path, url);
  }
  const loading = new Map();                       // один и тот же файл не качаем дважды одновременно

  async function fetchToDisk(path, target) {
    const response = await fetch(sources.get(path), { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`старый сайт ответил ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_BYTES) throw new Error("файл слишком большой");
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.part`;
    await writeFile(temp, body);
    await rename(temp, target);
  }

  /** Отдаёт файл или возвращает false, если это не файл старого сайта. */
  return async function serve(request, reply) {
    const path = decodeURIComponent((request.raw.url ?? "").split("?")[0]);
    if (!sources.has(path)) return false;
    const target = join(uploadsRoot, path.slice("/uploads/".length));
    try {
      if (!(await stat(target).catch(() => null))) {
        if (!loading.has(path)) loading.set(path, fetchToDisk(path, target).finally(() => loading.delete(path)));
        await loading.get(path);
      }
    } catch (error) {
      logger.warn({ path, error: error.message }, "Не удалось подтянуть файл старого сайта");
      return false;
    }
    reply.header("cache-control", "public, max-age=86400").type(TYPES[extname(path).toLowerCase()] ?? "application/octet-stream");
    reply.send(createReadStream(target));
    return true;
  };
}
