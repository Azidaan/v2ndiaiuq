import pg from "pg";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { databaseConfigFromEnv } from "./database/config.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedRoot = join(root, "server", "seeds", "news-2026");
const uploadsRoot = resolve(process.env.UPLOAD_DIR || join(root, "uploads"));
const replace = process.argv.includes("--replace");
const items = JSON.parse(await readFile(join(seedRoot, "news.json"), "utf8"));

function validate(news) {
  if (!Array.isArray(news) || news.length === 0) throw new Error("Файл новостей пуст");
  const slugs = new Set();
  for (const item of news) {
    if (item.type !== "news" || item.status !== "published") throw new Error("Допустимы только опубликованные новости");
    if (!String(item.published_at).startsWith("2026-")) throw new Error(`Новость не относится к 2026 году: ${item.slug}`);
    if (!item.title || !item.slug || !item.summary) throw new Error("У новости отсутствуют обязательные поля");
    if (/ваканси|замещение должност/i.test(`${item.title} ${item.slug}`)) throw new Error("Материалы о вакансиях запрещены в этом импорте");
    if (slugs.has(item.slug)) throw new Error(`Повторяющийся адрес новости: ${item.slug}`);
    slugs.add(item.slug);
  }
}

async function copyImages(news) {
  const destination = join(uploadsRoot, "news-2026");
  await mkdir(destination, { recursive: true });
  for (const item of news) {
    const filename = item.image_url.split("/").pop();
    if (!filename || !/^[a-z0-9-]+[.]jpg$/.test(filename)) throw new Error(`Некорректное имя изображения: ${item.image_url}`);
    await copyFile(join(seedRoot, "images", filename), join(destination, filename));
  }
}

validate(items);
await copyImages(items);

const pool = new pg.Pool({ ...databaseConfigFromEnv(process.env), max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  if (replace) await client.query("DELETE FROM content_items WHERE type = 'news'");
  for (const item of items) {
    await client.query(
      `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (slug) DO UPDATE SET
         type=EXCLUDED.type,title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,
         category=EXCLUDED.category,published_at=EXCLUDED.published_at,status=EXCLUDED.status,
         image_url=EXCLUDED.image_url,file_url=EXCLUDED.file_url,metadata=EXCLUDED.metadata,updated_at=now()`,
      [item.type, item.title, item.slug, item.summary, item.body, item.category, item.published_at, item.status, item.image_url, item.file_url, item.metadata],
    );
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ status: "ok", imported: items.length, replacedExistingNews: replace }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
