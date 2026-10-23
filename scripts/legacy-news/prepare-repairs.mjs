/** Prepare optimistic updates: preserve manual text/cover/date changes made in the CMS. */
import { JSDOM } from "jsdom";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { migrateGalleries } from "./galleries.mjs";
const key = (src = "") => src.toLowerCase().replace(/(?:[+_-](?:940[-_xх]480|300[-_xх]300|940))?(\.[a-z]+)$/i, "$1");
function repair(item) {
  const dom = new JSDOM(`<main>${item.body}</main>`), body = dom.window.document.querySelector("main");
  const cards = migrateGalleries(body);
  let duplicate = false, removed = 0;
  const seen = new Set();
  for (const img of body.querySelectorAll("img")) {
    const src = img.getAttribute("src"), id = key(src);
    if (id === key(item.image_url)) duplicate = true;
    if (seen.has(id)) { const figure = img.closest("figure"); if (figure && !figure.textContent.trim()) figure.remove(); else img.remove(); removed++; }
    else seen.add(id);
  }
  for (const row of body.querySelectorAll("[data-gallery]")) if (!row.querySelector("img")) row.remove();
  const result = { body: cards || removed ? body.innerHTML : item.body,
    ...(duplicate || item.slug === "2023-12-new-year" ? { hideArticleCover: true } : {}) };
  dom.window.close(); return result;
}
for (const file of await readdir("server/seeds/legacy-news")) {
  if (!/^news-.*\.json$/.test(file)) continue;
  const path = `server/seeds/legacy-news/${file}`;
  const seed = JSON.parse(await readFile(path, "utf8"));
  for (const item of seed.items) {
    const result = repair(item); item.body = result.body;
    if (result.hideArticleCover) item.metadata.hideArticleCover = true;
  }
  await writeFile(path, JSON.stringify(seed, null, 1) + "\n");
}
const items = await (await fetch("http://127.0.0.1:8080/api/content?type=news")).json();
const patches = [];
for (const item of items.filter((i) => i.metadata.importedFrom === "guiaidn.ru")) {
  const result = repair(item);
  if (result.body !== item.body || (result.hideArticleCover && !item.metadata.hideArticleCover)) {
    patches.push({ slug: item.slug, expectedBody: item.body, body: result.body, metadata: result.hideArticleCover ? { hideArticleCover: true } : {} });
  }
}
await writeFile("backups/legacy-news/live-patches.json", JSON.stringify(patches, null, 2));
console.log(JSON.stringify({ patches: patches.length, practice: patches.find((p) => p.slug === "2024-01-praktika")?.body }));
