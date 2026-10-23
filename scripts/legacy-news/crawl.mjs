/**
 * Разбор новостей старого сайта guiaidn.ru для переноса в CMS.
 *
 *   node scripts/legacy-news/crawl.mjs 2024 2025 2026
 *
 * Обходит архивы по годам (arhiv_novostey_<год>.html), с карточки берёт дату,
 * заголовок, анонс и миниатюру, со страницы новости — обложку 940x480 и текст.
 * Текст чистится от вёрстки старого сайта; картинки и документы старого сайта
 * переписываются на адреса /uploads/legacy-news/…, а сами файлы перечисляются
 * в assets — их скачает server/importLegacyNews.mjs уже на сервере.
 *
 * Результат: server/seeds/legacy-news/news-<годы>.json. Сеть нужна только здесь,
 * разбор HTML — jsdom из зависимостей разработки.
 */
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalize, selectDate, archivePages, readCards, skipReason } from "./extract.mjs";
import { migrateGalleries } from "./galleries.mjs";

const ORIGIN = "http://guiaidn.ru/";
const UPLOAD_PREFIX = "/uploads/legacy-news/";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const syncMode = process.argv.includes("--current");
const years = syncMode ? [new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Moscow" }).format(new Date())] : process.argv.slice(2).filter((y) => /^20\d\d$/.test(y));
if (!years.length) throw new Error("Укажите годы: node scripts/legacy-news/crawl.mjs 2024 2025 2026");

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|zip|rar|7z|mp4|webm)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cacheDir = process.env.LEGACY_NEWS_WORK_DIR ? join(process.env.LEGACY_NEWS_WORK_DIR, "html") : join(root, "backups", "legacy-news", "html");
await mkdir(cacheDir, { recursive: true });
async function fetchHtml(url) {
  const cache = join(cacheDir, decodeURIComponent(new URL(url).pathname.split("/").pop()));
  if (process.argv.includes("--cache")) {
    try { return await readFile(cache, "utf8"); } catch { /* fetch missing pages */ }
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const html = await res.text();
      await writeFile(cache, html);
      return html.replace(/\u00ad/g, "");
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(1000 * attempt);
    }
  }
}

/** Имя страницы старого сайта → адрес новости: 2026_09_Azov.html → 2026-09-azov. */
const slugFromPage = (page) => page.replace(/\.html?$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const TRANSLIT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya" };
/** Имя файла для /uploads: только латиница, цифры, точка, дефис; кириллица — транслитом. */
function safeName(name) {
  let decoded = name;
  try { decoded = decodeURIComponent(name); } catch { /* оставляем как есть */ }
  const latin = [...decoded.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  const dot = latin.lastIndexOf(".");
  const ext = dot > 0 ? latin.slice(dot + 1).replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? latin.slice(0, dot) : latin).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
  return ext ? `${base}.${ext}` : base;
}

// Категории на старом сайте не было — подбираем по словам, редактор поправит.
function guessCategory(text) {
  const t = text.toLowerCase();
  if (/конференц|форум|конгресс|семинар|выставк|симпозиум|кругл[а-я]+\s+стол|вебинар/.test(t)) return "conference";
  if (/аспирант|обучени|студент|школ|образоват|выпускник|курсы|курсов/.test(t)) return "education";
  if (/наук|исследован|статья|журнал|публикац|монограф|патент|грант|разработк/.test(t)) return "science";
  return "institute";
}

// Reserve paths from existing seeds: later imports must never overwrite a different asset.
const reservedAssets = new Map();
const existingPages = new Map();
const corrections = JSON.parse(await readFile(join(root, "scripts", "legacy-news", "corrections.json"), "utf8"));
const otherSeedPages = new Set();
const outputName = `news-${years.join("-")}.json`;
const seedDir = join(root, "server", "seeds", "legacy-news");
for (const file of await readdir(seedDir)) {
  if (!/^news-.*\.json$/.test(file)) continue;
  const seed = JSON.parse(await readFile(join(seedDir, file), "utf8"));
  for (const a of seed.assets) reservedAssets.set(a.url, a.path);
  for (const i of seed.items) {
    existingPages.set(i.metadata.legacyPage, i.slug);
    if (file !== outputName) otherSeedPages.add(i.metadata.legacyPage);
  }
}
if (syncMode && process.env.LEGACY_NEWS_KNOWN_PAGES) {
  for (const item of JSON.parse(await readFile(process.env.LEGACY_NEWS_KNOWN_PAGES, "utf8"))) {
    existingPages.set(item.legacyPage, item.slug); otherSeedPages.add(item.legacyPage);
  }
}
const assets = new Map();                         // адрес на старом сайте → путь в /uploads
function asset(src) {
  const url = new URL(src, ORIGIN);
  if (reservedAssets.has(url.href)) {
    const path = reservedAssets.get(url.href); assets.set(url.href, path); return path;
  }
  let name = safeName(url.pathname.split("/").pop() || "file");
  if (syncMode) name = name.replace(/(\.[a-z0-9]+)$/, `-${createHash("sha256").update(url.href).digest("hex").slice(0, 12)}$1`);
  let path = UPLOAD_PREFIX + name;
  // Одинаковые имена из разных папок старого сайта не должны затирать друг друга.
  for (let n = 2; [...reservedAssets.entries(), ...assets.entries()].some(([u, p]) => p === path && u !== url.href); n++) {
    path = UPLOAD_PREFIX + name.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
  }
  assets.set(url.href, path);
  return path;
}

/** Both archive generations; refuse a silent successful crawl of an empty archive. */
async function listYear(year) {
  const cards = [];
  const pages = syncMode ? ["arhiv_novostey.html", ...archivePages(year)] : archivePages(year);
  for (const page of pages) {
    let html;
    try { html = await fetchHtml(ORIGIN + page); }
    catch (error) { if (syncMode && cards.length) { console.warn(error.message); continue; } throw error; }
    const dom = new JSDOM(html);
    const list = readCards(dom.window.document, year, page);
    dom.window.close();
    if (!list.length) throw new Error(`Не найдены карточки: ${page}`);
    cards.push(...list);
  }
  return cards;
}

/** Чистит текст новости и переписывает ссылки на файлы старого сайта. */
function cleanBody(container, pageToSlug) {
  const doc = container.ownerDocument;
  container.querySelectorAll("script, style, noscript, hr, gcse\\:search, .descr, .description").forEach((n) => n.remove());
  // Заголовок первого уровня на странице один — это название новости.
  container.querySelectorAll("h1").forEach((h) => { const h2 = doc.createElement("h2"); h2.innerHTML = h.innerHTML; h.replaceWith(h2); });
  // Таблицы редактор CMS не поддерживает: строка таблицы становится пунктом списка.
  container.querySelectorAll("table").forEach((table) => {
    const ul = doc.createElement("ul");
    table.querySelectorAll("tr").forEach((tr) => {
      const cells = [...tr.children].map((td) => td.innerHTML.trim()).filter(Boolean);
      if (!cells.length) return;
      const li = doc.createElement("li");
      li.innerHTML = cells.join(" — ");
      ul.append(li);
    });
    table.replaceWith(ul);
  });
  // Видео со старого сайта — ссылкой на файл, который скачается вместе с картинками.
  container.querySelectorAll("video").forEach((video) => {
    const src = video.getAttribute("src") || video.querySelector("source")?.getAttribute("src") || "";
    const p = doc.createElement("p");
    if (src) { const a = doc.createElement("a"); a.setAttribute("href", src); a.textContent = "Смотреть видео"; p.append(a); }
    video.replaceWith(p);
  });
  // Видео со сторонних сайтов CMS не показывает — оставляем ссылкой.
  container.querySelectorAll("iframe").forEach((frame) => {
    const src = frame.getAttribute("src") ?? "";
    const p = doc.createElement("p");
    if (src) { const a = doc.createElement("a"); a.href = src;
      a.textContent = /formstruct\.ru/.test(src) ? "Открыть форму регистрации" : "Смотреть видео"; p.append(a); }
    frame.replaceWith(p);
  });
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const url = new URL(src, ORIGIN);
    if (url.origin + "/" !== ORIGIN || !IMAGE_EXT.test(url.pathname)) return img.remove();
    img.setAttribute("src", asset(src));
  });
  container.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || /^(mailto|tel):/i.test(href)) return;
    const url = new URL(href, ORIGIN);
    const page = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (url.origin + "/" === ORIGIN && (FILE_EXT.test(page) || IMAGE_EXT.test(page))) a.setAttribute("href", asset(href));
    else if (url.origin + "/" === ORIGIN && pageToSlug.has(page)) a.setAttribute("href", `/news/${pageToSlug.get(page)}`);
    else a.setAttribute("href", url.href);
    if (!a.getAttribute("href").startsWith("/")) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
  });
  // Атрибуты оформления старого сайта не нужны: классы, стили, размеры.
  container.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (!["href", "src", "alt", "target", "rel", "colspan", "rowspan", "data-gallery", "data-image-block"].includes(attr.name)) el.removeAttribute(attr.name);
    }
  });
  // Пустые абзацы и цепочки переносов, которыми старый сайт делал отступы.
  container.querySelectorAll("p, div, figure, span").forEach((el) => {
    if (!el.textContent.trim() && !el.querySelector("img, a")) el.remove();
  });
  let html = container.innerHTML
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<br\s*\/?>\s*){2,}/gi, "<br>")
    .replace(/^\s*(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+\s*$/gi, "")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return html.replace(/\u00ad/g, "");
}

const cards = [];
for (const year of years) {
  const list = await listYear(year);
  console.log(`${year}: карточек ${list.length}`);
  cards.push(...list.map((c) => ({ ...c, year })));
}

const skipped = [];
const seen = new Set();
const todo = cards.filter((c) => {
  const why = skipReason(c, seen) || (otherSeedPages.has(c.page) ? "уже перенесено в другом JSON" : null);
  if (why) { skipped.push({ page: c.page, title: c.title, why }); return false; }
  seen.add(c.page);
  return true;
});
const pageToSlug = new Map([...existingPages, ...todo.map((c) => [c.page, slugFromPage(c.page)])]);

const items = [];
for (const card of todo) {
  const url = ORIGIN + card.page;
  let document;
  try {
    ({ document } = new JSDOM(await fetchHtml(url)).window);
  } catch (error) {
    skipped.push({ page: card.page, title: card.title, why: `страница не открылась: ${error.message}` });
    continue;
  }
  const content = document.querySelector("#content_inner");
  if (!content) { skipped.push({ page: card.page, title: card.title, why: "нет блока #content_inner" }); continue; }
  const heading = content.querySelector("h3");
  const headingText = normalize(heading?.textContent);
  // Read text after removing scripts and layout-only duplicate gallery captions.
  content.querySelectorAll("script, style, noscript, gcse\\:search, .descr, .description").forEach((n) => n.remove());
  const correction = corrections[card.page] ?? {};
  const dateInfo = correction.date
    ? { date: correction.date, source: "source-review", approximate: false }
    : selectDate(card, headingText, normalize(content.textContent).slice(0, 2000));
  const date = dateInfo.date;
  const dateApprox = dateInfo.approximate;
  heading?.remove();                              // дата и заголовок — в своих полях
  // Обложка: картинка 940x480, иначе первая крупная, иначе миниатюра карточки.
  migrateGalleries(content);
  const imageOnly = !normalize(content.textContent) && Boolean(content.querySelector("img"));
  const imgs = [...content.querySelectorAll("img")];
  const cover = imgs.find((i) => /[+_-]940[-_xх]480\./i.test(i.getAttribute("src") ?? "")) ?? imgs[0] ?? null;
  let image = "";
  if (cover) {
    image = asset(cover.getAttribute("src"));
    if (!imageOnly) (cover.closest("figure") ?? cover.closest("a") ?? cover).remove(); // на странице новости обложка выводится отдельно
    // Старый сайт ставил под текстом то же фото целиком (…-940.jpg) — это дубль обложки.
    const imageKey = (src) => decodeURIComponent(new URL(src, ORIGIN).pathname).toLowerCase()
      .replace(/(?:[+_-](?:940[-_xх]480|300[-_xх]300|940))?(\.[a-z]+)$/i, "$1");
    const imageKeys = new Set([imageKey(cover.getAttribute("src"))]);
    for (const img of content.querySelectorAll("img")) {
      if (imageOnly && img === cover) continue;
      const key = imageKey(img.getAttribute("src"));
      if (imageKeys.has(key)) (img.closest("figure") ?? img.closest("a") ?? img).remove();
      else imageKeys.add(key);
    }
  } else if (card.thumb) {
    image = asset(card.thumb);
  }
  if (correction.image) image = asset(correction.image);
  const title = correction.title || (card.old ? headingText || card.title : card.title || headingText)
    .replace(/^\d{1,2}\s+[а-яё]+\s+20\d\d(\s*г\.)?\s*[-–—.]?\s*/i, "") || card.page;
  const summaryText = card.summary || normalize(content.textContent) || card.title || title;
  let body = cleanBody(content, pageToSlug);
  // Открытки-поздравления состоят из одной картинки: текстом станет анонс.
  if (!body.replace(/<[^>]+>/g, "").trim()) {
    body = `<p>${summaryText.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` + body;
  }
  const summary = summaryText.length > 420 ? summaryText.slice(0, 400).replace(/\s+\S*$/, "") + "…" : summaryText;
  items.push({
    type: "news",
    title,
    slug: pageToSlug.get(card.page),
    summary,
    body,
    category: correction.category || guessCategory(`${title} ${summary}`),
    published_at: `${date}T09:00:00+03:00`,
    status: "published",
    image_url: image,
    file_url: "",
    metadata: {
      tags: [],
      legacyArchive: card.archivePage,
      dateSource: dateInfo.source,
      ...(correction.imageFallbackFrom ? { imageFallbackFrom: correction.imageFallbackFrom } : {}),
      ...(syncMode ? { legacyAssets: [...assets.entries()].filter(([, path]) => image === path || body.includes(path)).map(([url, path]) => ({ url, path })) } : {}),
      ...(imageOnly ? { hideArticleCover: true } : {}),
      ...(correction.note ? { migrationNote: correction.note } : {}),
      ...(dateApprox ? { dateApprox: true } : {}),
      ...(card.rubric ? { legacyRubric: card.rubric } : {}),
      importedFrom: "guiaidn.ru",
      sourceUrl: url,
      legacyPage: card.page,
    },
  });
  process.stdout.write(".");
  document.defaultView.close();
  await sleep(150);                                // не нагружаем старый сервер
}
process.stdout.write("\n");

const out = process.env.LEGACY_NEWS_WORK_DIR ? join(process.env.LEGACY_NEWS_WORK_DIR, "news-current.json") : join(root, "server", "seeds", "legacy-news", outputName);
await mkdir(dirname(out), { recursive: true });
const referencedPaths = new Set(JSON.stringify(items).match(/\/uploads\/legacy-news\/[a-z0-9.-]+/g) ?? []);
const assetList = [...assets.entries()].filter(([, path]) => referencedPaths.has(path)).map(([url, path]) => ({ url, path }));
await writeFile(out, JSON.stringify({ years, createdAt: new Date().toISOString(), items, assets: assetList, skipped }, null, 1) + "\n");
console.log(JSON.stringify({ news: items.length, assets: assetList.length, skipped: skipped.length, out }));
for (const s of skipped) console.log(`  пропущено: ${s.page} — ${s.why} — ${s.title}`);
