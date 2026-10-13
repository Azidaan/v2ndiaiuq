/**
 * Перенос новостей старого сайта guiaidn.ru в CMS.
 *
 *   node server/importLegacyNews.mjs [файл.json …] [--update] [--review]
 *
 * Без аргументов берёт все server/seeds/legacy-news/news-*.json — их готовит
 * scripts/legacy-news/crawl.mjs. Скачивает картинки и документы старого сайта
 * в UPLOAD_DIR/legacy-news и добавляет новости.
 *
 * Новость, которая уже есть в базе (по адресу), не трогается — правки из
 * админки не пропадут при повторном запуске. --update перезаписывает ранее
 * перенесённые новости заново. --review помечает новости «требует проверки»
 * (так переносятся 2018–2023: у них разметка старого сайта неоднородна).
 */
import pg from "pg";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseConfigFromEnv } from "./database/config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedRoot = join(root, "server", "seeds", "legacy-news");
const uploadsRoot = resolve(process.env.UPLOAD_DIR || join(root, "uploads"));
const args = process.argv.slice(2);
const update = args.includes("--update");
const review = args.includes("--review");
const files = args.filter((a) => !a.startsWith("--"));
const seeds = files.length ? files : (await readdir(seedRoot)).filter((f) => /^news-.*\.json$/.test(f)).map((f) => join(seedRoot, f));
if (!seeds.length) throw new Error(`Нет файлов с новостями в ${seedRoot}`);

const items = [];
const assets = new Map();
for (const file of seeds) {
  const data = JSON.parse(await readFile(file, "utf8"));
  items.push(...data.items);
  for (const a of data.assets) assets.set(a.path, a.url);
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
async function worker() {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [path, url] = next;
    const target = join(uploadsRoot, "legacy-news", basename(path));
    if (await exists(target)) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      await writeFile(target, Buffer.from(await res.arrayBuffer()));
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
    const metadata = { ...item.metadata, ...(review ? { needsReview: true } : {}) };
    const values = [item.type, item.title, item.slug, item.summary, dropFailed(item.body), item.category,
      item.published_at, item.status, failed.has(item.image_url) ? "" : item.image_url, item.file_url, metadata];
    const { rows } = await client.query("SELECT metadata->>'importedFrom' AS source FROM content_items WHERE slug = $1", [item.slug]);
    if (!rows.length) {
      await client.query(
        `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, values);
      inserted++;
    } else if (update && rows[0].source === "guiaidn.ru") {
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
console.log(JSON.stringify({ status: "ok", news: items.length, inserted, updated, kept, files: assets.size, downloaded, failed: failed.size }));
