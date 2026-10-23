import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { archivePages, readCards, selectDate, dateFromPage, parseDate, skipReason } from "./extract.mjs";

describe("legacy archives", () => {
  it("prefers the article button over an image link and handles dates without years", () => {
    const dom = new JSDOM('<div class="year-section-2"><a href="img/photo.jpg">Фото</a><div class="date-overlay">9 октября</div><div class="arhiv_text"><span><b>Новость</b> Анонс</span><a class="more_button" href="2026_10_news.html">ПОДРОБНЕЕ</a></div></div>');
    const [card] = readCards(dom.window.document, "2026", "arhiv_novostey.html");
    expect(card.page).toBe("2026_10_news.html"); expect(card.date).toBe("2026-10-09"); expect(card.summary).toBe("Анонс");
    dom.window.close();
  });
  it("reads both 2018 archives and uses article titles when archive headings are empty", () => {
    expect(archivePages(2018)).toHaveLength(2);
    const dom = new JSDOM('<div class="arhiv"><h4><br><span></span></h4><a href="20181204_Veeam.html"><img src="img/a.jpg"></a></div>');
    const [card] = readCards(dom.window.document, "2018", archivePages(2018)[0]);
    expect(card.page).toBe("20181204_Veeam.html");
    expect(card.title).toBe("");
    expect(selectDate(card, "Вебинар", "4 декабря 2018 года").date).toBe("2018-12-04");
    dom.window.close();
  });
  it("does not interpret anniversary numbers as publication days", () => {
    expect(dateFromPage("2022_10_31_years.html")).toEqual({ date: "2022-10-01", exact: false });
    expect(selectDate({ page: "2022_10_31_years.html", year: "2022" }, "9 октября 2022 г.", "").date).toBe("2022-10-09");
    expect(dateFromPage("2023_10_32_years_IPII.html").date).toBe("2023-10-01");
  });
  it("keeps the publication month for an announcement of a future event", () => {
    expect(selectDate({ page: "201905_ICC.html", year: "2019" }, "Конгресс", "20 июня 2019 года")).toMatchObject({ date: "2019-05-01", approximate: true });
    expect(selectDate({ page: "20180628_FTI.html", year: "2018" }, "Конференция", "25 октября 2018 года").date).toBe("2018-06-28");
  });
  it("rejects invalid dates, finds matching dates after historical ones and handles ranges", () => {
    expect(parseDate("31.02.2021")).toBeNull();
    expect(parseDate("16-17 марта 2023 г.")).toBe("2023-03-16");
    expect(selectDate({ page: "2022_11_GO.html", year: "2022" }, "", "21 октября 2022 г.; 1 ноября 2022 г.").date).toBe("2022-11-01");
  });
  it("skips journal links, permanent pages, vacancies and duplicates", () => {
    for (const page of ["pai_journal.html", "aspirantura.html", "biblioteka.html"]) expect(skipReason({ page }, new Set())).toContain("постоянная");
    expect(skipReason({ page: "news.html", external: true }, new Set())).toContain("пределы");
    expect(skipReason({ page: "2023_job.html", title: "Конкурс на замещение должности" }, new Set())).toBe("вакансия");
    expect(skipReason({ page: "AI-2021.html" }, new Set(["AI-2021.html"]))).toBe("повтор");
  });
});
