import { Link, useParams } from "react-router";
import { Calendar, Tag, ArrowLeft } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { NEWS, formatDate, CATEGORY_LABELS } from "../data";
import { useManagedContent } from "../lib/content";
import type { NewsCategory } from "../data";
import SafeHtml from "../components/SafeHtml";
import SafeImage, { parseFocus, type ImageFocus } from "../components/ui/SafeImage";
import { htmlToPlainText } from "../lib/sanitize";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { items: managedNews, loading, error } = useManagedContent("news");
  const news = !error && managedNews.length > 0 ? managedNews.map((entry) => ({
    id: entry.slug, title: entry.title, date: entry.published_at,
    category: (entry.category || "institute") as NewsCategory,
    excerpt: entry.summary, body: entry.body, image: entry.image_url || undefined,
    tags: (entry.metadata.tags as string[] | undefined) ?? [],
    focus: parseFocus(entry.metadata.focus),
    hideArticleCover: entry.metadata.hideArticleCover === true,
  })) : NEWS.map((entry) => ({ ...entry, focus: undefined as ImageFocus | undefined, hideArticleCover: false }));
  const item = news.find((n) => n.id === id);

  if (loading && !item) return <div className="max-w-[1280px] mx-auto px-4 py-16 text-center text-muted-foreground">Загрузка...</div>;

  if (!item) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Материал не найден</h1>
        <Link to="/news" className="text-accent hover:underline text-sm">← Вернуться к новостям</Link>
      </div>
    );
  }

  const related = news.filter((n) => n.id !== item.id && n.category === item.category).slice(0, 3);
  const intro = htmlToPlainText(item.excerpt).replace(/…$/, "").trim();
  const showIntro = intro && intro !== item.title && !htmlToPlainText(item.body).startsWith(intro);

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[
        { label: "Новости", path: "/news" },
        { label: item.title.slice(0, 40) + (item.title.length > 40 ? "…" : "") },
      ]} />

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Article body */}
          <article className="flex-1 min-w-0">
            <Link to="/news" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors mb-5">
              <ArrowLeft size={13} aria-hidden="true" /> К списку новостей
            </Link>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary uppercase tracking-wider">
                <Tag size={11} aria-hidden="true" /> {CATEGORY_LABELS[item.category]}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" /> {formatDate(item.date)}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-5 leading-snug" style={{ fontFamily: "var(--font-display)" }}>
              {item.title}
            </h1>

            {item.image && !item.hideArticleCover && (
              <div className="mb-6 aspect-[940/480] w-full overflow-hidden rounded bg-secondary">
                <SafeImage src={item.image} alt={item.title} focus={item.focus} slot="article" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="prose prose-sm max-w-none text-foreground leading-relaxed">
              {showIntro && <SafeHtml html={item.excerpt} className="text-base font-medium mb-4" />}
              <SafeHtml html={item.body} />
            </div>

            {item.tags && item.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-5">
            <div className="bg-card border border-border rounded p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Похожие материалы</h2>
              {related.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {related.map((n) => (
                    <Link
                      key={n.id}
                      to={`/news/${n.id}`}
                      className="group block"
                    >
                      <p className="text-[11px] text-muted-foreground mb-0.5">{formatDate(n.date)}</p>
                      <p className="text-[13px] text-foreground group-hover:text-accent transition-colors leading-snug">
                        {n.title}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Нет похожих материалов.</p>
              )}
            </div>

            <div className="bg-secondary border border-border rounded p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Разделы сайта</h2>
              <ul className="space-y-1.5">
                {[
                  { label: "Все новости", path: "/news" },
                  { label: "Наука", path: "/science" },
                  { label: "Образование", path: "/education" },
                  { label: "Публикации", path: "/publications" },
                  { label: "Конференции", path: "/science/events" },
                ].map((l) => (
                  <li key={l.path}>
                    <Link to={l.path} className="text-xs text-accent hover:underline">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
