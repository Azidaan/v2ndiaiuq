import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Начальные материалы для пустой базы. Нужны бесплатному хостингу: база там
 * создаётся с нуля и загрузить в неё дамп из закрытой сети нельзя.
 *
 * Включается BOOTSTRAP_CONTENT=true. Грузит server/seeds/bootstrap/content.json
 * (только материалы: без пользователей админки, сессий и обращений граждан), и только
 * пока в content_items нет ни одной записи — уже существующие данные не трогаются.
 */
export async function bootstrapContent({ pool, root, logger, enabled }) {
  if (!enabled) return { loaded: 0 };
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM content_items");
  if (rows[0].n > 0) return { loaded: 0 };
  const items = JSON.parse(await readFile(join(root, "server", "seeds", "bootstrap", "content.json"), "utf8"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        `INSERT INTO content_items (type,title,slug,summary,body,category,published_at,status,image_url,file_url,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (slug) DO NOTHING`,
        [item.type, item.title, item.slug, item.summary, item.body, item.category, item.published_at, item.status, item.image_url, item.file_url, item.metadata ?? {}],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  logger.info({ loaded: items.length }, "Начальные материалы загружены");
  return { loaded: items.length };
}
