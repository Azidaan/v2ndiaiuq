import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, Filter } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { NEWS, formatDate, CATEGORY_LABELS, type NewsCategory } from "../data";
import { useManagedContent } from "../lib/content";
import SafeHtml from "../components/SafeHtml";
import DatePeriodPicker, { matchesPeriod, type DatePeriod } from "../components/ui/DatePeriodPicker";
import SafeImage from "../components/ui/SafeImage";

const ALL_CATEGORIES: { value: NewsCategory | "all"; label: string }[] = [
  { value: "all", label: "Все новости" },
  { value: "institute", label: "Институт" },
  { value: "science", label: "Наука" },
  { value: "education", label: "Образование" },
  { value: "conference", label: "Конференции" },
];

export default function NewsListPage() {
  const { items: managedNews, error } = useManagedContent("news");
  const [searchParams] = useSearchParams();
  const initCat = (searchParams.get("cat") as NewsCategory) || "all";
  const [category, setCategory] = useState<NewsCategory | "all">(initCat);
  const [period, setPeriod] = useState<DatePeriod>(null);
  const [query, setQuery] = useState("");

  const news = !error && managedNews.length > 0 ? managedNews.map((item) => ({
    id: item.slug, title: item.title, date: item.published_at,
    category: (item.category || "institute") as NewsCategory,
    excerpt: item.summary, body: item.body, image: item.image_url || undefined,
  })) : NEWS;
  const filtered = news.filter((n) => {
    if (category !== "all" && n.category !== category) return false;
    if (!matchesPeriod(n.date, period)) return false;
    if (query && !n.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Новости" }]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Новости института
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          {/* Search */}
          <div className="flex items-center border border-border rounded bg-card px-3 py-1.5 gap-2 focus-within:border-accent transition-colors w-full sm:w-64">
            <Search size={14} className="text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              placeholder="Поиск новостей..."
              aria-label="Поиск новостей"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
            />
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Filter size={14} className="text-muted-foreground" aria-hidden="true" />
            {ALL_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  category === c.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-accent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Дата: год, месяц или конкретный день */}
          <DatePeriodPicker
            value={period}
            onChange={setPeriod}
            dates={news.map((n) => n.date)}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Новостей по заданным фильтрам не найдено.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => (
              <Link
                key={item.id}
                to={`/news/${item.id}`}
                className="bg-card rounded border border-border hover:border-accent hover:shadow-sm group transition-all overflow-hidden flex flex-col"
              >
                {item.image && (
                  <div className="h-44 bg-secondary overflow-hidden shrink-0">
                    <SafeImage src={item.image} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{formatDate(item.date)}</span>
                  </div>
                  <h2 className="text-[14px] font-semibold text-foreground group-hover:text-accent transition-colors leading-snug mb-2 flex-1" style={{ fontFamily: "var(--font-display)" }}>
                    {item.title}
                  </h2>
                  <SafeHtml html={item.excerpt} className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
