/** Shared, testable rules for the two generations of legacy archives. */
export const normalize = (text = "") => text.replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();
const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const monthOf = (word) => MONTHS.findIndex((stem) => word.toLowerCase().replace(/^авт/, "авг").startsWith(stem)) + 1;
export function isoDate(year, month, day) {
  const d = new Date(Date.UTC(+year, +month - 1, +day));
  return d.getUTCFullYear() === +year && d.getUTCMonth() === +month - 1 && d.getUTCDate() === +day
    ? d.toISOString().slice(0, 10) : null;
}
/** Return all candidates: an unrelated historical date must not hide a later relevant one. */
export function datesIn(text = "", fallbackYear) {
  const s = normalize(text).replace(/\b(\d{1,2})\s*[-–]\s*\d{1,2}\s*([а-яё]+)\s+(20\d\d)/gi, "$1 $2 $3");
  const found = [];
  const pattern = /\b(\d{1,2})\s+([а-яё]+)\s+(20\d\d)|\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b/gi;
  for (const m of s.matchAll(pattern)) {
    const date = m[1] ? isoDate(m[3], monthOf(m[2]), m[1]) : isoDate(m[6], m[5], m[4]);
    if (date) found.push(date);
  }
  if (!found.length && fallbackYear) {
    // Only a leading date without a year; do not turn a holiday mentioned in prose into publication time.
    const m = /^(\d{1,2})\s+([а-яё]+)(?![а-яё])(?:\s|$)/i.exec(s);
    if (m) { const d = isoDate(fallbackYear, monthOf(m[2]), m[1]); if (d) found.push(d); }
  }
  return found;
}
export const parseDate = (text, year) => datesIn(text, year)[0] ?? null;
export function dateFromPage(page) {
  // Only compact YYYYMMDD carries a day: in 2022_10_31_years, 31 is an anniversary.
  const m = /^(20\d\d)(?:(\d{2})(\d{2})?(?=[^0-9]|$)|[_-](\d{2})(?=[^0-9]|$))/.exec(page);
  if (m?.[4]) m[2] = m[4];
  if (!m || !isoDate(m[1], m[2], m[3] || 1)) return null;
  return { date: isoDate(m[1], m[2], m[3] || 1), exact: Boolean(m[3]) };
}
export function selectDate(card, heading, start) {
  const name = dateFromPage(card.page);
  const year = name?.date.slice(0, 4) ?? card.year;
  const matches = (d) => d.startsWith(String(year)) && (!name || d.slice(0, 7) === name.date.slice(0, 7));
  // Compact YYYYMMDD filenames record publication, even when the article announces a future event.
  if (card.date) return { date: card.date, source: "archive", approximate: false };
  if (name?.exact) return { date: name.date, source: "filename-day", approximate: false };
  for (const [source, text] of [["heading", heading], ["article", start], ["archive-text", card.archiveText]]) {
    const date = datesIn(text, year).find(matches);
    if (date) return { date, source, approximate: false };
  }
  return { date: name?.date ?? `${card.year}-01-01`, source: name ? "filename-month" : "archive-year", approximate: true };
}
export function archivePages(year) {
  return String(year) === "2018" ? ["arhiv_novostey_2018_1.html", "arhiv_novostey_2018_2.html"] : [`arhiv_novostey_${year}.html`];
}
export function readCards(document, year, archivePage) {
  return [...document.querySelectorAll(".year-section-2, .arhiv")].map((card) => {
    const old = card.matches(".arhiv");
    const link = (card.querySelector("a.more_button") ?? card.querySelector("a[href]"))?.getAttribute("href")?.trim() ?? "";
    let url; try { url = new URL(link, "http://guiaidn.ru/"); } catch { /* recorded as skipped */ }
    const textBox = old ? card.querySelector("h4") : card.querySelector(".arhiv_text span") ?? card.querySelector(".arhiv_text") ?? card.querySelector(".arhiv_text-button > span");
    const clone = textBox?.cloneNode(true);
    clone?.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
    const archiveText = normalize(clone?.textContent);
    const title = old ? archiveText : normalize(textBox?.querySelector("b")?.textContent);
    if (!old) clone?.querySelector("b")?.remove();
    const overlay = normalize(card.querySelector(".date-overlay")?.textContent);
    const overlayDate = parseDate(overlay, /20\d\d/.exec(link)?.[0] ?? year);
    return { page: url ? decodeURIComponent(url.pathname.split("/").pop()) : "", external: !url || url.hostname !== "guiaidn.ru",
      title, summary: old ? "" : normalize(clone?.textContent), archiveText, old,
      date: overlayDate, rubric: overlayDate ? "" : overlay,
      thumb: card.querySelector(".new_arhiv img, img")?.getAttribute("src") ?? "", year, archivePage };
  });
}
export function skipReason(card, seen) {
  if (!card.page || card.external) return "ссылка ведёт за пределы сайта";
  if (/ваканси|замещени[ея] должност/i.test(`${card.title} ${card.page}`)) return "вакансия";
  // News have a year in the filename, including AI-2020-book. Everything else is a permanent section.
  if (!/\.html?$/i.test(card.page) || !/20\d\d/.test(card.page)) return "постоянная страница, не новость";
  if (seen.has(card.page)) return "повтор";
  return null;
}
