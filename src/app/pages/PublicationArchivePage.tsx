import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { PUBLICATION_ARCHIVE_SECTIONS } from "../data/publicationsArchive";
import { useManagedContent } from "../lib/content";
import SafeHtml from "../components/SafeHtml";

function highlightCategories(content: string) {
  if (/<\/?(strong|b|em|i|u|s|strike|ul|ol|li|p|div|br)\b/i.test(content)) {
    return <SafeHtml html={content} className="prose prose-sm max-w-none text-foreground leading-relaxed" />;
  }
  const categories = [
    "Список публикаций сотрудников",
    "Защита кандидатской диссертации",
    "Статьи",
    "Тезисы, доклады, материалы конференций",
    "Тезисы",
    "Методические пособия",
    "Другие публикации",
    "Научная работа",
  ];

  return content.split("\n").map((line, index) => {
    const trimmed = line.trim();
    const isCategory = categories.some((category) => trimmed.startsWith(category));

    if (!trimmed) {
      return <br key={index} />;
    }

    if (isCategory) {
      return (
        <h3 key={index} className="mt-5 mb-2 text-sm font-bold uppercase tracking-wide text-primary">
          {trimmed}
        </h3>
      );
    }

    return (
      <p key={index} className="mb-2 text-sm leading-relaxed text-foreground">
        {trimmed}
      </p>
    );
  });
}

export default function PublicationArchivePage() {
  const { items: managedPublications, error } = useManagedContent("publication");
  const [year, setYear] = useState<string>("all");
  const [query, setQuery] = useState("");

  const sections = !error && managedPublications.length > 0
    ? Array.from(new Set(managedPublications.map((item) => item.published_at.slice(0, 4)))).map((sectionYear) => ({
        year: sectionYear,
        content: managedPublications
          .filter((item) => item.published_at.startsWith(sectionYear))
          .map((item) => `${item.title}\n${item.body}`)
          .join("\n\n"),
      }))
    : PUBLICATION_ARCHIVE_SECTIONS;
  const availableYears = sections.map((section) => section.year);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sections.filter((section) => {
      if (year !== "all" && section.year !== year) return false;
      if (!normalizedQuery) return true;

      return `${section.year} ${section.content}`.toLowerCase().includes(normalizedQuery);
    });
  }, [query, year, sections]);

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs
        crumbs={[
          { label: "Публикации", path: "/publications" },
          { label: "Архив по годам" },
        ]}
      />

      <main className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent mb-2">2017-2026</p>
            <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-display)" }}>
              Публикации сотрудников
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen size={16} aria-hidden="true" />
            <span>{sections.length} годовых разделов</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
          <div className="flex items-center border border-border rounded bg-card px-3 py-2 gap-2 focus-within:border-accent transition-colors w-full sm:max-w-md">
            <Search size={15} className="text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              placeholder="Поиск по названию, автору, журналу..."
              aria-label="Поиск публикаций"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="text-sm border border-border rounded px-3 py-2 bg-card text-foreground outline-none hover:border-accent transition-colors"
            aria-label="Фильтр по году"
          >
            <option value="all">Все годы</option>
            {availableYears.map((sectionYear) => (
              <option key={sectionYear} value={sectionYear}>
                {sectionYear}
              </option>
            ))}
          </select>
        </div>

        {filteredSections.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            По заданным параметрам публикации не найдены.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {filteredSections.map((section, index) => (
              <details
                key={section.year}
                open={year !== "all" || query.trim().length > 0 || index === 0}
                className="group bg-card border border-border rounded overflow-hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-secondary/60 transition-colors">
                  <span className="text-base font-bold text-primary">{section.year} год</span>
                  <span className="text-xs font-medium text-muted-foreground group-open:hidden">Развернуть</span>
                  <span className="text-xs font-medium text-muted-foreground hidden group-open:inline">Свернуть</span>
                </summary>
                <div className="border-t border-border px-4 py-4">
                  {highlightCategories(section.content)}
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
