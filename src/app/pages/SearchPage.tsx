import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { DEPARTMENTS, DOCUMENTS, EVENTS, NAV, NEWS, PUBLICATIONS, VACANCIES, type DocumentCategory } from "../data";
import { RESEARCH_ITEMS } from "./ScienceResearchPage";
import { CERTIFICATES } from "./ScienceCertificatesPage";
import { documentCategoryPath } from "../data/documentCategories";
import { useAllManagedContent, type ManagedContent } from "../lib/content";
import { htmlToPlainText } from "../lib/sanitize";
import { getSearchScore, normalizeSearchText, type SearchEntry } from "../lib/search";

const SECTION_ENTRIES: SearchEntry[] = NAV.flatMap((item) => [
  { title: item.label, description: `Раздел сайта «${item.label}»`, path: item.path, type: "Раздел" },
  ...(item.children ?? []).map((child) => ({
    title: child.label,
    description: `Страница раздела «${item.label}»`,
    path: child.path,
    type: "Раздел",
  })),
]);

const SEARCH_ENTRIES: SearchEntry[] = [
  ...SECTION_ENTRIES,
  ...NEWS.map((item) => ({
    title: item.title,
    description: item.excerpt,
    path: `/news/${item.id}`,
    type: "Новость",
    searchText: [item.body, ...(item.tags ?? [])].join(" "),
  })),
  ...DEPARTMENTS.map((item) => ({
    title: item.name,
    description: item.description,
    path: `/institute/departments/${item.id}`,
    type: "Научный отдел",
    searchText: [item.shortName, ...item.areas, ...(item.projects ?? []), ...(item.extra ?? [])].join(" "),
  })),
  ...RESEARCH_ITEMS.map((item) => ({
    title: item.title,
    description: item.paragraphs?.[0] ?? item.summary ?? "",
    path: `/science/research/${item.id}`,
    type: "Исследование",
    searchText: [item.navTitle, ...(item.paragraphs ?? []), ...(item.sections ?? []).flatMap((section) => [section.title, ...section.items]), item.quote ?? ""].join(" "),
  })),
  ...CERTIFICATES.map((item) => ({
    title: item.title,
    description: `Свидетельство № ${item.number}, ${item.year} год`,
    path: "/science/rid",
    type: "Свидетельство для ЭВМ",
    searchText: `${item.authors} ${item.application} ${item.extra ?? ""}`,
  })),
  ...PUBLICATIONS.map((item) => ({
    title: item.title,
    description: `${item.authors.join(", ")}. ${item.journal ?? "Научная публикация"}, ${item.year}`,
    path: "/publications",
    type: "Публикация",
    searchText: [item.authors.join(" "), item.journal ?? "", item.abstract ?? "", item.year].join(" "),
  })),
  ...DOCUMENTS.map((item) => ({
    title: item.title,
    description: `Документ · ${item.ext} · ${item.date}`,
    path: documentCategoryPath(item.category),
    type: "Документ",
  })),
  ...VACANCIES.map((item) => ({
    title: item.title,
    description: `${item.department} · ${item.salary}`,
    path: "/vacancies",
    type: "Вакансия",
    searchText: [...item.requirements, ...(item.duties ?? [])].join(" "),
  })),
  ...EVENTS.map((item) => ({
    title: item.title,
    description: item.description,
    path: "/science/events",
    type: "Мероприятие",
    searchText: `${item.location} ${item.date}`,
  })),
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { items: managedItems, error } = useAllManagedContent();
  const query = searchParams.get("q")?.trim() ?? "";
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  const entries = !error && managedItems.length > 0
    ? mergeManagedEntries(SEARCH_ENTRIES, managedItems)
    : SEARCH_ENTRIES;
  const results = terms.length
    ? entries
        .map((entry) => ({ entry, score: getSearchScore(entry, terms) }))
        .filter((item) => item.score >= 0)
        .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, "ru"))
        .map((item) => item.entry)
    : [];

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Поиск" }]} />
      <div className="max-w-[960px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-5" style={{ fontFamily: "var(--font-display)" }}>
          Поиск по сайту
        </h1>

        <form
          role="search"
          className="flex items-center border border-border rounded bg-card px-4 py-2.5 gap-3 focus-within:border-accent transition-colors"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextQuery = String(form.get("q") ?? "").trim();
            setSearchParams(nextQuery ? { q: nextQuery } : {});
          }}
        >
          <Search size={17} className="text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            key={query}
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Введите поисковый запрос"
            aria-label="Поисковый запрос"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-accent transition-colors">
            Найти
          </button>
        </form>

        {query ? (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-4" aria-live="polite">
              {results.length > 0
                ? `По запросу «${query}» найдено: ${results.length}`
                : `По запросу «${query}» ничего не найдено.`}
            </p>

            {results.length > 0 && (
              <ul className="flex flex-col gap-3">
                {results.map((result, index) => (
                  <li key={`${result.path}-${result.title}-${index}`}>
                    <Link
                      to={result.path}
                      className="block bg-card border border-border rounded p-4 hover:border-accent hover:shadow-sm transition-all group"
                    >
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-accent">{result.type}</span>
                      <h2 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors mt-1">
                        {result.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">{result.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-6">Введите запрос, чтобы найти материалы на сайте.</p>
        )}
      </div>
    </div>
  );
}

function managedEntry(item: ManagedContent): SearchEntry | null {
  if (item.type === "visual_block") return null;
  const typeLabels: Record<ManagedContent["type"], string> = {
    news: "Новость",
    publication: "Публикация",
    vacancy: "Вакансия",
    document: "Документ",
    visual_block: "Служебный блок",
    research: "Исследование",
    certificate: "Свидетельство для ЭВМ",
    department: "Научный отдел",
  };
  const path = item.type === "news"
    ? `/news/${item.slug}`
    : item.type === "document"
      ? documentCategoryPath((item.category || "normative") as DocumentCategory)
      : item.type === "vacancy"
          ? "/vacancies"
          : item.type === "publication"
            ? "/publications"
            : item.type === "research"
              ? `/science/research/${item.slug}`
              : item.type === "certificate"
                ? "/science/rid"
                : item.type === "department"
                  ? `/institute/departments/${item.slug}`
                  : "/";
  return {
    title: item.title,
    description: htmlToPlainText(item.summary || item.body).slice(0, 240),
    path,
    type: typeLabels[item.type],
    searchText: htmlToPlainText(`${item.summary} ${item.body}`),
  };
}

function mergeManagedEntries(staticEntries: SearchEntry[], items: ManagedContent[]) {
  const dynamicEntries = items.map(managedEntry).filter((entry): entry is SearchEntry => Boolean(entry));
  const replacedTypes = new Set(dynamicEntries.map((entry) => entry.type));
  return [...staticEntries.filter((entry) => !replacedTypes.has(entry.type)), ...dynamicEntries];
}
