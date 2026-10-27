import { Link, useParams } from "react-router";
import { Calendar, Tag, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { formatDate, CATEGORY_LABELS } from "../data";
import { useManagedContent } from "../lib/content";
import type { NewsCategory } from "../data";
import SafeHtml from "../components/SafeHtml";
import SafeImage, { parseFocus } from "../components/ui/SafeImage";
import { htmlToPlainText } from "../lib/sanitize";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { items: managedNews, loading, error } = useManagedContent("news");
  const news = managedNews.map((entry) => ({
    id: entry.slug, title: entry.title, date: entry.published_at,
    category: (entry.category || "institute") as NewsCategory,
    excerpt: entry.summary, body: entry.body, image: entry.image_url || undefined,
    tags: (entry.metadata.tags as string[] | undefined) ?? [],
    focus: parseFocus(entry.metadata.focus),
    hideArticleCover: entry.metadata.hideArticleCover === true,
  }));
  const item = news.find((n) => n.id === id);

  if (loading && !item) return <div className="max-w-[1280px] mx-auto px-4 py-16 text-center text-muted-foreground">Загрузка...</div>;
  if (error) return <p role="alert" className="px-4 py-16 text-center text-muted-foreground">Не удалось загрузить новость. Обновите страницу.</p>;

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
    <div className="news-detail" style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[
        { label: "Новости", path: "/news" },
        { label: item.title.slice(0, 40) + (item.title.length > 40 ? "…" : "") },
      ]} />

      <div className="news-detail-layout">
          {/* Article body */}
          <article className="news-article news-detail-paper">
            <Link to="/news" className="news-detail-back">
              <ArrowLeft size={13} aria-hidden="true" /> К списку новостей
            </Link>

            <header className="news-detail-header">
              <div className="news-detail-meta">
                <span className="news-detail-category">
                  <Tag size={11} aria-hidden="true" /> {CATEGORY_LABELS[item.category]}
                </span>
                <time dateTime={item.date} className="inline-flex items-center gap-1.5">
                  <Calendar size={11} aria-hidden="true" /> {formatDate(item.date)}
                </time>
              </div>

              <h1>{item.title}</h1>
            </header>

            {item.image && !item.hideArticleCover && (
              <div className="news-detail-cover relative aspect-[940/480] w-full overflow-hidden">
                <SafeImage src={item.image} alt={item.title} focus={item.focus} slot="article" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}

            <div className="prose news-detail-body">
              {showIntro && <SafeHtml html={item.excerpt} className="news-detail-intro" />}
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
            <footer className="news-detail-footer">
              <Link to="/news">Все новости института <ArrowRight size={16} aria-hidden="true" /></Link>
            </footer>
          </article>

          {/* Sidebar */}
          <aside className="news-detail-sidebar" aria-label="Навигация по новостям и разделам сайта">
            <nav className="news-detail-panel news-detail-sections" aria-labelledby="news-sections-heading">
              <h2 id="news-sections-heading">Разделы сайта</h2>
              <ul>
                {[
                  { label: "Все новости", path: "/news" },
                  { label: "Наука", path: "/science" },
                  { label: "Образование", path: "/education" },
                  { label: "Публикации", path: "/publications" },
                  { label: "Конференции", path: "/science/events" },
                ].map((l) => (
                  <li key={l.path}>
                    <Link to={l.path}>{l.label}<ChevronRight size={14} aria-hidden="true" /></Link>
                  </li>
                ))}
              </ul>
            </nav>

            <section className="news-detail-panel news-detail-related" aria-labelledby="news-related-heading">
              <h2 id="news-related-heading">Похожие материалы</h2>
              {related.length > 0 ? (
                <div>
                  {related.map((n) => (
                    <Link
                      key={n.id}
                      to={`/news/${n.id}`}
                      className="news-detail-related-link"
                    >
                      {n.image && <span className="news-detail-thumbnail"><SafeImage src={n.image} alt="" focus={n.focus} slot="card" className="absolute inset-0 h-full w-full" /></span>}
                      <span className="min-w-0">
                        <time dateTime={n.date}>{formatDate(n.date)}</time>
                        <span className="news-detail-related-title">{n.title}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Нет похожих материалов.</p>
              )}
            </section>
          </aside>
      </div>
    </div>
  );
}
