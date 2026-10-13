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
import { JSDOM } from "jsdom";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "http://guiaidn.ru/";
const UPLOAD_PREFIX = "/uploads/legacy-news/";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const years = process.argv.slice(2).filter((y) => /^20\d\d$/.test(y));
if (!years.length) throw new Error("Укажите годы: node scripts/legacy-news/crawl.mjs 2024 2025 2026");

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|zip|rar|7z|mp4|webm)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
// Объявления о вакансиях и конкурсах на должности — не новости, их ведут в своём разделе.
const NOT_NEWS = /ваканси|замещени[ея] должност/i;
// Постоянные страницы старого сайта, на которые ссылаются карточки архива:
// их содержимое живёт в своих разделах нового сайта, а не в новостях.
const PERMANENT_PAGES = /^(aspirantura|anticorupcia[^.]*|vakansii[^.]*|documenty|kontakty|istoriya|science|education|publish).html/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchHtml(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.text();
    } catch (error) {
      if (attempt >= 3) throw error;
      await sleep(1000 * attempt);
    }
  }
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** Номер месяца по слову; «автуста» — опечатка на старом сайте. */
function monthOf(word) {
  const w = word.toLowerCase().replace(/^авт/, "авг");
  const month = MONTHS.findIndex((stem) => w.startsWith(stem));
  return month < 0 ? null : month + 1;
}
/**
 * Дата из текста: «29 декабря 2025 г.», «25.06.2024», а с fallbackYear —
 * и «8 сентября» без года (на карточках архива год подразумевается).
 */
function parseDate(text, fallbackYear) {
  const s = text ?? "";
  let m = /(\d{1,2})\s+([а-яё]+)\s+(20\d\d)/i.exec(s);
  if (m && monthOf(m[2])) return iso(m[3], monthOf(m[2]), m[1]);
  m = /\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b/.exec(s);
  if (m && +m[2] >= 1 && +m[2] <= 12) return iso(m[3], m[2], m[1]);
  m = fallbackYear ? /^\s*(\d{1,2})\s+([а-яё]+)\s*$/i.exec(s) : null;
  if (m && monthOf(m[2])) return iso(fallbackYear, monthOf(m[2]), m[1]);
  return null;
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
  if (/конференц|форум|конгресс|семинар|выставк|симпозиум|круглый стол|вебинар/.test(t)) return "conference";
  if (/аспирант|обучени|студент|практик|школ|образоват|выпускник|курс/.test(t)) return "education";
  if (/наук|исследован|статья|журнал|публикац|монограф|патент|грант|разработк/.test(t)) return "science";
  return "institute";
}

const assets = new Map();                         // адрес на старом сайте → путь в /uploads
function asset(src) {
  const url = new URL(src, ORIGIN);
  const name = safeName(url.pathname.split("/").pop() || "file");
  let path = UPLOAD_PREFIX + name;
  // Одинаковые имена из разных папок старого сайта не должны затирать друг друга.
  for (let n = 2; [...assets.entries()].some(([u, p]) => p === path && u !== url.href); n++) {
    path = UPLOAD_PREFIX + name.replace(/(\.[a-z0-9]+)$/, `-${n}$1`);
  }
  assets.set(url.href, path);
  return path;
}

/** Карточки архива за год. */
async function listYear(year) {
  const { document } = new JSDOM(await fetchHtml(`${ORIGIN}arhiv_novostey_${year}.html`)).window;
  return [...document.querySelectorAll(".year-section-2")].map((card) => {
    const link = card.querySelector("a.more_button")?.getAttribute("href") || card.querySelector("a")?.getAttribute("href") || "";
    // Обычно текст в .arhiv_text, в части карточек 2024 года — прямо в span кнопочного блока.
    const textBox = card.querySelector(".arhiv_text span") ?? card.querySelector(".arhiv_text")
      ?? card.querySelector(".arhiv_text-button > span");
    const title = textBox?.querySelector("b")?.textContent.replace(/\s+/g, " ").trim() ?? "";
    const clone = textBox?.cloneNode(true);
    clone?.querySelector("b")?.remove();
    const summary = clone?.textContent.replace(/\s+/g, " ").trim() ?? "";
    const overlay = card.querySelector(".date-overlay")?.textContent.replace(/s+/g, " ").trim() ?? "";
    return {
      page: link.split("/").pop(),
      // Вместо даты на карточке бывает рубрика: «Мы в СМИ», «Аспирантура».
      rubric: parseDate(overlay) ? "" : overlay,
      external: /^https?:/i.test(link) && !link.startsWith(ORIGIN),
      title,
      summary,
      date: parseDate(overlay),
      thumb: card.querySelector(".new_arhiv img")?.getAttribute("src") ?? "",
    };
  });
}

/** Чистит текст новости и переписывает ссылки на файлы старого сайта. */
function cleanBody(container, pageToSlug) {
  const doc = container.ownerDocument;
  container.querySelectorAll("script, style, noscript, hr, gcse\\:search").forEach((n) => n.remove());
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
    if (src) { const a = doc.createElement("a"); a.href = src; a.textContent = "Смотреть видео"; p.append(a); }
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
    const page = url.pathname.split("/").pop() ?? "";
    if (url.origin + "/" === ORIGIN && FILE_EXT.test(page)) a.setAttribute("href", asset(href));
    else if (url.origin + "/" === ORIGIN && pageToSlug.has(page)) a.setAttribute("href", `/news/${pageToSlug.get(page)}`);
    else a.setAttribute("href", url.href);
    if (!a.getAttribute("href").startsWith("/")) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); }
  });
  // Атрибуты оформления старого сайта не нужны: классы, стили, размеры.
  container.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (!["href", "src", "alt", "target", "rel", "colspan", "rowspan"].includes(attr.name)) el.removeAttribute(attr.name);
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
  return html;
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
  const why = !c.page || c.external ? "ссылка ведёт за пределы сайта"
    : NOT_NEWS.test(`${c.title} ${c.page}`) ? "вакансия"
    : PERMANENT_PAGES.test(c.page) ? "постоянная страница, не новость"
    : seen.has(c.page) ? "повтор" : null;
  if (why) { skipped.push({ page: c.page, title: c.title, why }); return false; }
  seen.add(c.page);
  return true;
});
const pageToSlug = new Map(todo.map((c) => [c.page, slugFromPage(c.page)]));

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
  // Дата: на карточке, иначе в заголовке статьи, в анонсе или в начале текста.
  // Не нашлась — год и месяц из имени файла (2025_06_…), такую дату помечаем.
  // Дата из текста годится, только если сходится с годом из имени файла или
  // архива: в тексте бывают даты прошлых событий («основан в 2018 г.»).
  const fromName = /^(20\d\d)[_-](\d\d)/.exec(card.page);
  const year = fromName ? fromName[1] : card.year;
  const plausible = (d) => (d && Math.abs(+d.slice(0, 4) - +year) <= (fromName ? 0 : 1) ? d : null);
  let date = card.date
    ?? plausible(parseDate(heading?.textContent))
    ?? plausible(parseDate(card.summary))
    ?? plausible(parseDate(content.textContent.slice(0, 600)));
  let dateApprox = false;
  if (!date) {
    date = fromName ? `${fromName[1]}-${fromName[2]}-01` : `${card.year}-01-01`;
    dateApprox = true;
  }
  heading?.remove();                              // дата и заголовок — в своих полях
  // Обложка: картинка 940x480, иначе первая крупная, иначе миниатюра карточки.
  const imgs = [...content.querySelectorAll("img")];
  const cover = imgs.find((i) => /-940-480\./i.test(i.getAttribute("src") ?? "")) ?? null;
  let image = "";
  if (cover) {
    image = asset(cover.getAttribute("src"));
    (cover.closest("figure") ?? cover).remove(); // на странице новости обложка выводится отдельно
  } else if (card.thumb) {
    image = asset(card.thumb);
  }
  let body = cleanBody(content, pageToSlug);
  // Открытки-поздравления состоят из одной картинки: текстом станет анонс.
  if (!body.replace(/<[^>]+>/g, "").trim()) {
    body = `<p>${card.summary.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` + body;
  }
  const summary = card.summary.length > 420 ? card.summary.slice(0, 400).replace(/\s+\S*$/, "") + "…" : card.summary;
  items.push({
    type: "news",
    // Заголовок с карточки, иначе из статьи без даты в начале («30 мая 2024 - …»).
    title: card.title || (heading?.textContent ?? "").replace(/\s+/g, " ").trim()
      .replace(/^\d{1,2}\s+[а-яё]+\s+20\d\d(\s*г\.)?\s*[-–—.]?\s*/i, "") || card.page,
    slug: pageToSlug.get(card.page),
    summary,
    body,
    category: guessCategory(`${card.title} ${card.summary}`),
    published_at: `${date}T09:00:00+03:00`,
    status: "published",
    image_url: image,
    file_url: "",
    metadata: {
      tags: [],
      ...(dateApprox ? { dateApprox: true } : {}),
      ...(card.rubric ? { legacyRubric: card.rubric } : {}),
      importedFrom: "guiaidn.ru",
      sourceUrl: url,
      legacyPage: card.page,
    },
  });
  process.stdout.write(".");
  await sleep(150);                                // не нагружаем старый сервер
}
process.stdout.write("\n");

const out = join(root, "server", "seeds", "legacy-news", `news-${years.join("-")}.json`);
await mkdir(dirname(out), { recursive: true });
const assetList = [...assets.entries()].map(([url, path]) => ({ url, path }));
await writeFile(out, JSON.stringify({ years, createdAt: new Date().toISOString(), items, assets: assetList, skipped }, null, 1) + "\n");
console.log(JSON.stringify({ news: items.length, assets: assetList.length, skipped: skipped.length, out }));
for (const s of skipped) console.log(`  пропущено: ${s.page} — ${s.why} — ${s.title}`);
