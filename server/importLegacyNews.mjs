/**
 * Перенос новостей старого сайта guiaidn.ru в CMS.
 *
 *   node server/importLegacyNews.mjs [файл.json …] [--update]
 *
 * Без аргументов берёт все server/seeds/legacy-news/news-*.json — их готовит
 * scripts/legacy-news/crawl.mjs. Скачивает картинки и документы старого сайта
 * в UPLOAD_DIR/legacy-news и добавляет новости.
 *
 * Новость, которая уже есть в базе (по адресу), не трогается — правки из
 * админки не пропадут при повторном запуске. --update перезаписывает ранее
 * перенесённые новости заново, сохраняя только отметку «Проверено».
 * Все перенесённые новости приходят непроверенными — их отмечают в админке.
 */
import pg from "pg";
import { access, mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseConfigFromEnv } from "./database/config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedRoot = join(root, "server", "seeds", "legacy-news");
const uploadsRoot = resolve(process.env.UPLOAD_DIR || join(root, "uploads"));
const args = process.argv.slice(2);
const update = args.includes("--update");
const files = args.filter((a) => !a.startsWith("--"));
const seeds = files.length ? files : (await readdir(seedRoot)).filter((f) => /^news-.*\.json$/.test(f)).map((f) => join(seedRoot, f));
if (!seeds.length) throw new Error(`Нет файлов с новостями в ${seedRoot}`);

const items = [];
const assets = new Map();
for (const file of seeds) {
  const data = JSON.parse(await readFile(file, "utf8"));
  items.push(...data.items);
  for (const a of data.assets) {
    if (assets.has(a.path) && assets.get(a.path) !== a.url) throw new Error(`Конфликт файлов: ${a.path}`);
    assets.set(a.path, a.url);
  }
}

// Защита от случайного содержимого: пишем только в свою папку и только новости.
for (const [path] of assets) {
  if (!/^\/uploads\/legacy-news\/[a-z0-9][a-z0-9.-]*$/.test(path)) throw new Error(`Недопустимый путь файла: ${path}`);
}
const slugs = new Set();
for (const item of items) {
  if (item.type !== "news" || !item.title || !/^[a-z0-9-]+$/.test(item.slug)) throw new Error(`Некорректная новость: ${item.slug}`);
  if (slugs.has(item.slug)) throw new Error(`Повторяющийся адрес новости: ${item.slug}`);
  slugs.add(item.slug);
}

// ---- файлы ----
const exists = (p) => access(p).then(() => true, () => false);
const failed = new Set();
let downloaded = 0;
const queue = [...assets.entries()];
await mkdir(join(uploadsRoot, "legacy-news"), { recursive: true });
async function download(url, target) {
  for (let attempt = 1; ; attempt++) {
    const temp = `${target}.part-${randomUUID()}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok || res.headers.get("content-type")?.includes("text/html")) {
        await res.body?.cancel();
        throw Object.assign(new Error(`${res.status}: файл недоступен`), { permanent: res.status >= 400 && res.status < 500 });
      }
      await pipeline(Readable.fromWeb(res.body), createWriteStream(temp));
      await rename(temp, target);
      return;
    } catch (error) {
      await rm(temp, { force: true });
      if (error.permanent || attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}
async function worker() {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [path, url] = next;
    const target = join(uploadsRoot, "legacy-news", basename(path));
    if (await exists(target)) continue;
    try {
      await download(url, target);
      downloaded++;
    } catch (error) {
      failed.add(path);
      console.warn(`не скачан ${url}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

/** Убирает из текста картинки, которые не удалось скачать, — иначе на странице будут дыры. */
const dropFailed = (html) => html.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (tag, src) => (failed.has(src) ? "" : tag));

// ---- база ----
const pool = new pg.Pool({ ...databaseConfigFromEnv(process.env), max: 1 });
const client = await pool.connect();
let inserted = 0, updated = 0, kept = 0;
try {
  await client.query("BEGIN");
  for (const item of items) {
    const { rows } = await client.query("SELECT metadata FROM content_items WHERE slug = $1", [item.slug]);
    const old = rows[0]?.metadata ?? null;
    const unavailable = [...failed].filter((path) => item.image_url === path || item.body.includes(path));
    const metadata = { ...item.metadata,
      ...(unavailable.length ? { legacyAssetFailures: unavailable.map((path) => ({ path, url: assets.get(path) })) } : {}),
      ...(old?.reviewed ? { reviewed: true } : {}) };
    const values = [item.type, item.title, item.slug, item.summary, dropFailed(item.body), item.category,
      item.published_at, item.status, failed.has(item.image_url) ? "" : item.image_url, item.file_url, metadata];
    if (!old) {
      await client.query(
        `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, values);
      inserted++;
    } else if (update && old.importedFrom === "guiaidn.ru") {
      await client.query(
        `UPDATE content_items SET type=$1,title=$2,summary=$4,body=$5,category=$6,published_at=$7,status=$8,
           image_url=$9,file_url=$10,metadata=$11,updated_at=now() WHERE slug=$3`, values);
      updated++;
    } else {
      kept++;                                      // уже есть — не трогаем
    }
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
console.log(JSON.stringify({ status: "ok", news: items.length, inserted, updated, kept, files: assets.size, downloaded, failed: failed.size, failedAssets: [...failed].map((path) => ({ path, url: assets.get(path) })) }));
