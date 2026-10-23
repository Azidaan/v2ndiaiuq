/** Reproducible source/seed/live checks. This never marks news as reviewed. */
import { JSDOM } from "jsdom";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalize, isoDate } from "./extract.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backup = join(root, "backups/legacy-news");
await mkdir(join(backup, "html"), { recursive: true });
const live = process.argv.includes("--live");
const fetchSources = process.argv.includes("--fetch-sources");
const checkAssets = process.argv.includes("--assets");
const seeds = [];
for (const f of await readdir(join(root, "server/seeds/legacy-news"))) {
  if (/^news-.*\.json$/.test(f)) seeds.push(JSON.parse(await readFile(join(root, "server/seeds/legacy-news", f), "utf8")));
}
const assets = new Map(), errors = [], slugs = new Set();
for (const seed of seeds) for (const a of seed.assets) {
  if (assets.has(a.path) && assets.get(a.path) !== a.url) errors.push(`asset collision: ${a.path}`);
  assets.set(a.path, a.url);
}
const items = live ? await (await fetch("http://127.0.0.1:8080/api/content?type=news")).json() : seeds.flatMap((s) => s.items);
const imported = items.filter((i) => i.metadata.importedFrom === "guiaidn.ru");
for (const i of imported) for (const a of i.metadata.legacyAssets ?? []) assets.set(a.path, a.url);
const plain = (node) => {
  const c = node.cloneNode(true);
  c.querySelectorAll("br").forEach((e) => e.replaceWith(" "));
  c.querySelectorAll("p,div,li,td,th,h2,h3,h4,figcaption").forEach((e) => e.append(" "));
  return c.textContent;
};
const tokens = (s) => normalize(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const imageKey = (src) => decodeURIComponent(src).toLowerCase().replace(/(?:[+_-](?:940[-_xх]480|300[-_xх]300|940))?(\.[a-z]+)$/i, "$1");
const reports = [];
for (const i of imported) {
  const issues = [];
  if (!i.title.trim() || /\.html?$/i.test(i.title)) issues.push("empty/fallback title");
  if (slugs.has(i.slug)) errors.push(`duplicate slug: ${i.slug}`);
  slugs.add(i.slug);
  const date = i.published_at.slice(0, 10).split("-");
  if (!isoDate(...date)) issues.push("invalid date");
  if (i.metadata.dateApprox) issues.push("approximate date");
  const dom = new JSDOM(`<main>${i.body}</main>`), body = dom.window.document.querySelector("main");
  if (body.querySelector("script,style,table,video,iframe")) issues.push("legacy markup");
  const localFiles = [...new Set([i.image_url, ...[...body.querySelectorAll("[src],[href]")].map((el) => el.getAttribute("src") || el.getAttribute("href"))].filter((p) => p?.startsWith("/uploads/")))];
  const images = [...body.querySelectorAll("img")].map((img) => img.getAttribute("src"));
  if (new Set(images.map(imageKey)).size !== images.length) issues.push("duplicate body image");
  if (!i.metadata.hideArticleCover && images.some((src) => imageKey(src) === imageKey(i.image_url))) issues.push("cover repeated in body");
  const oldLinks = [...body.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((href) => /^https?:\/\/guiaidn.ru\/.*\.html/i.test(href));
  let source;
  const path = join(backup, "html", i.metadata.legacyPage);
  try { source = await readFile(path, "utf8"); } catch {
    if (fetchSources) {
      try {
        const response = await fetch(i.metadata.sourceUrl, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(String(response.status));
        source = await response.text(); await writeFile(path, source);
      } catch (e) { issues.push(`source unavailable: ${e.message}`); }
    }
  }
  let textComplete = null, missingImages = [];
  if (source) {
    const original = new JSDOM(source), content = original.window.document.querySelector("#content_inner");
    if (!content) issues.push("missing source content");
    else {
      content.querySelectorAll("script,style,noscript,gcse\\:search,.arhiv h4,.descr,.description,iframe,video").forEach((n) => n.remove());
      content.querySelector("h3")?.remove();
      const actual = tokens(plain(body)), expected = tokens(plain(content));
      // A subsequence allows table separators and fallback captions, but catches lost words or truncation.
      let at = 0; for (const t of actual) if (expected[at] === t) at++;
      textComplete = at === expected.length;
      if (!textComplete) issues.push(`text differs after word ${at}/${expected.length}: ${expected.slice(at, at + 12).join(" ")}`);
      const copied = new Set([i.image_url, ...images].map((p) => assets.get(p)).filter(Boolean).map((u) => imageKey(new URL(u).pathname)));
      if (i.metadata.imageFallbackFrom && copied.size && i.image_url) copied.add(imageKey(new URL(i.metadata.imageFallbackFrom).pathname));
      missingImages = [...new Set([...content.querySelectorAll("img")].map((img) => imageKey(new URL(img.getAttribute("src"), "http://guiaidn.ru/").pathname)))].filter((key) => !copied.has(key));
      if (missingImages.length) issues.push("source images not represented");
    }
    original.window.close();
  } else issues.push("source not checked");
  reports.push({ slug: i.slug, legacyPage: i.metadata.legacyPage, date: i.published_at.slice(0, 10), category: i.category, title: i.title, textComplete, missingImages, localFiles, oldLinks, issues });
  dom.window.close();
}
const assetResults = [];
if (checkAssets) {
  const queue = [...new Set(reports.flatMap((r) => r.localFiles))];
  async function worker() {
    for (let path = queue.shift(); path; path = queue.shift()) {
      try {
        const url = live ? `http://127.0.0.1:8080${path}` : assets.get(path);
        if (!url) throw new Error("not in manifest");
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20000) });
        const type = response.headers.get("content-type");
        assetResults.push({ path, status: response.status, type, ok: response.ok && !type?.includes("text/html") });
      } catch (e) { assetResults.push({ path, ok: false, error: e.message }); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const r of reports) for (const a of assetResults) if (!a.ok && r.localFiles.includes(a.path)) r.issues.push(`asset unavailable: ${a.path}`);
}
const result = { createdAt: new Date().toISOString(), mode: live ? "live" : "seeds", count: reports.length, errors, summary: { approximate: reports.filter((r) => r.issues.includes("approximate date")).length, textDifferences: reports.filter((r) => r.textComplete === false).length, missingImages: reports.filter((r) => r.missingImages.length).length, failedAssets: assetResults.filter((a) => !a.ok).length }, items: reports, assets: assetResults };
const out = join(backup, `audit-${live ? "live" : "seeds"}.json`);
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ count: result.count, ...result.summary, errors, out }));
if (errors.length) process.exitCode = 1;
