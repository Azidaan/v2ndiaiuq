import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, ChevronLeft, Newspaper, Calendar, BookOpen, ArrowRight, FileText, GraduationCap, FlaskConical, Building2, ExternalLink, type LucideIcon } from "lucide-react";
import { formatDate, CATEGORY_LABELS, type NewsCategory, type NewsItem } from "../data";
import naukaRfLogo from "../../imports/nauka-rf-logo.png";
import { useManagedContent } from "../lib/content";
import SafeHtml from "../components/SafeHtml";
import SafeImage, { parseFocus, type ImageFocus } from "../components/ui/SafeImage";

type HomeNewsItem = NewsItem & { featured?: boolean; featuredOrder?: number; focus?: ImageFocus };
type HomeBlock = { title: string; summary: string; tag: string; path: string; image?: string; hidden?: boolean };

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  institute: "bg-blue-100 text-blue-700",
  science: "bg-green-100 text-green-700",
  education: "bg-amber-100 text-amber-700",
  conference: "bg-purple-100 text-purple-700",
};

const HERO_TRANSITION_MS = 900;
const QUICK_ACCESS_CARD_CLASS = "flex flex-col items-center gap-2 bg-card p-4 rounded border border-border hover:border-accent hover:shadow-sm group transition-all text-center";

type QuickAccessItem = {
  icon: LucideIcon;
  label: string;
  href: string;
  external?: boolean;
};

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  { icon: GraduationCap, label: "Аспирантура", href: "/education" },
  { icon: FlaskConical, label: "Исследования и разработки", href: "/science/research" },
  { icon: BookOpen, label: "Журнал «Проблемы искусственного интеллекта»", href: "http://paijournal.guiaidn.ru/", external: true },
  { icon: Building2, label: "Научные отделы", href: "/institute/departments" },
  { icon: FileText, label: "Документы", href: "/documents" },
  { icon: Newspaper, label: "Вакансии", href: "/vacancies" },
];

function QuickAccessCard({ icon: Icon, label, href, external = false }: QuickAccessItem) {
  const content = (
    <>
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
        <Icon size={18} className="text-primary group-hover:text-white transition-colors" aria-hidden="true" />
      </div>
      <span className="inline-flex items-center justify-center gap-1 text-xs text-foreground leading-tight">
        {label}
        {external && <ExternalLink size={11} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
      </span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={QUICK_ACCESS_CARD_CLASS}>
        {content}
      </a>
    );
  }

  return <Link to={href} className={QUICK_ACCESS_CARD_CLASS}>{content}</Link>;
}

type HeroSlideCardProps = {
  item: HomeNewsItem;
  slides: HomeNewsItem[];
  activeIndex: number;
  exiting?: boolean;
  /** Боковая колонка скрыта — слайдер занимает всю ширину и раскладка меняется. */
  wide?: boolean;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
};

function HeroSlideCard({ item, slides, activeIndex, exiting = false, wide = false, onSelect, onPrevious, onNext }: HeroSlideCardProps) {
  return (
    <div
      className={`${exiting ? "hero-slide-exit pointer-events-none" : "hero-slide-enter"} flex h-full min-h-[360px] flex-col sm:flex-row`}
      aria-hidden={exiting || undefined}
    >
      <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col justify-between">
        <div className={wide ? "lg:max-w-[70ch]" : undefined}>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-3 ${CATEGORY_COLORS[item.category]}`}>
            {CATEGORY_LABELS[item.category]}
          </span>
          <p className="text-xs text-muted-foreground mb-2">{formatDate(item.date)}</p>
          <h2 className={`text-lg ${wide ? "lg:text-xl" : ""} font-bold leading-snug text-foreground mb-3`} style={{ fontFamily: "var(--font-display)" }}>
            {item.title}
          </h2>
          <SafeHtml html={item.excerpt} className="text-sm text-muted-foreground leading-relaxed line-clamp-4" />
        </div>
        <div className="hero-slide-controls flex flex-wrap items-center gap-3 sm:gap-4 mt-4">
          <Link
            to={`/news/${item.id}`}
            className="flex items-center gap-2 bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Подробнее <ChevronRight size={15} aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-1.5 ml-auto">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => onSelect(index)}
                aria-label={`Слайд ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`w-2 h-2 rounded-full transition-colors ${index === activeIndex ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <button
            onClick={onPrevious}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
            aria-label="Предыдущий слайд"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button
            onClick={onNext}
            className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-secondary transition-colors"
            aria-label="Следующий слайд"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      {item.image && (
        <div className="relative aspect-[600/280] w-full shrink-0 self-stretch overflow-hidden sm:w-[600px] sm:max-w-[63%]">
          <SafeImage
            src={item.image}
            alt={item.title}
            focus={item.focus}
            slot="slider"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

function HeroSlider({ news, blocks }: { news: HomeNewsItem[]; blocks: Record<string, HomeBlock> }) {
  const [slide, setSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const slideRef = useRef(0);
  const selected = news.filter((item) => item.featured).sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999));
  const slides = (selected.length > 0 ? selected : news.slice(0, 3));
  useEffect(() => { if (slide >= slides.length) setSlide(0); }, [slide, slides.length]);
  useEffect(() => { slideRef.current = slide; }, [slide]);
  useEffect(() => {
    if (slides.length < 2 || paused) return;

    const timer = window.setInterval(() => {
      const current = slideRef.current;
      setPreviousSlide(current);
      setSlide((current + 1) % slides.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [slides.length, paused]);
  useEffect(() => {
    if (previousSlide === null) return;
    const timer = window.setTimeout(() => setPreviousSlide(null), HERO_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [previousSlide, slide]);
  if (slides.length === 0) return <div className="min-h-[300px] border border-border bg-card rounded flex items-center justify-center text-sm text-muted-foreground">Новости для слайдера пока не выбраны.</div>;
  const selectSlide = (next: number) => {
    const normalized = (next + slides.length) % slides.length;
    if (normalized === slide) return;
    setPreviousSlide(slide);
    setSlide(normalized);
  };
  // Управляется из визуального редактора: block:home:cards, metadata.hidden.
  const showCards = blocks.cards?.hidden !== true;

  return (
    <div className={`flex ${showCards ? "lg:gap-5" : ""}`}>
      {/* Main slide */}
      <div className="hero-slider grid relative flex-1 min-w-0 bg-white rounded-sm overflow-hidden shadow-sm border border-border min-h-[360px]"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
        {slides.map((item, index) => (
          <div key={item.id} style={{ gridArea: "1 / 1", zIndex: index === previousSlide ? 2 : index === slide ? 1 : 0, visibility: index === slide || index === previousSlide ? "visible" : "hidden" }}
            aria-hidden={index !== slide || undefined} {...(index !== slide ? { inert: "" } : {})}>
            <HeroSlideCard item={item} slides={slides} activeIndex={slide} exiting={index === previousSlide && index !== slide}
              wide={!showCards} onSelect={selectSlide} onPrevious={() => selectSlide(slide - 1)} onNext={() => selectSlide(slide + 1)} />
          </div>
        ))}
      </div>

      {/* Right sidebar cards */}
      {showCards && (
      <div className="hidden lg:flex flex-col gap-2 w-[280px] shrink-0 self-stretch">
        {[
          {
            tag: blocks.program?.tag || "Программа",
            tagColor: "text-amber-600",
            title: blocks.program?.title || "ДМКС-ИИ-2026: Международный круглый стол по ИИ в Донецке",
            path: blocks.program?.path || "/science/dmks",
            Icon: Calendar,
          },
          {
            tag: blocks.journal?.tag || "Журнал",
            tagColor: "text-accent",
            title: blocks.journal?.title || "«Проблемы ИИ» включён в Перечень ВАК К2 — «Белый список»",
            path: blocks.journal?.path || "/publications/journal",
            Icon: BookOpen,
          },
          {
            tag: blocks.congratulations?.tag || "Поздравляем!",
            tagColor: "text-green-600",
            title: blocks.congratulations?.title || "Выпуск журнала ИПИИ №2 (28) 2026 года вышел в свет",
            path: blocks.congratulations?.path || "/publications/journal",
            Icon: Newspaper,
          },
        ].map((card) => (
          <Link
            key={card.path + card.title}
            to={card.path}
            className="flex flex-1 gap-3 bg-white p-3 border border-border rounded hover:border-accent group transition-colors"
          >
            <div className="w-10 h-10 shrink-0 rounded bg-secondary flex items-center justify-center">
              <card.Icon size={18} className="text-primary opacity-60" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wide ${card.tagColor}`}>{card.tag}</span>
              <p className="text-[12px] text-foreground leading-snug mt-0.5 line-clamp-3 group-hover:text-accent transition-colors">
                {card.title}
              </p>
            </div>
            <ChevronRight size={13} className="text-muted-foreground group-hover:text-accent shrink-0 self-center" aria-hidden="true" />
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}

function NewsCarousel({ news }: { news: HomeNewsItem[] }) {
  const [active, setActive] = useState(0);
  const visibleCount = Math.min(3, news.length);
  const visibleNews = news.length > 0 ? Array.from({ length: visibleCount }, (_, index) => news[(active + index) % news.length]) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-primary" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary">Новости института</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/news" className="text-xs text-accent hover:underline flex items-center gap-1 mr-1">
            Все новости <ArrowRight size={12} aria-hidden="true" />
          </Link>
          <button
            onClick={() => news.length > 0 && setActive((index) => (index - 1 + news.length) % news.length)}
            className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
            aria-label="Предыдущие новости"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button
            onClick={() => news.length > 0 && setActive((index) => (index + 1) % news.length)}
            className="w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center hover:border-accent hover:text-accent transition-colors"
            aria-label="Следующие новости"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleNews.map((item) => (
          <Link
            key={`${active}-${item.id}`}
            to={`/news/${item.id}`}
            className="group flex min-w-0 flex-col overflow-hidden rounded border border-border bg-card transition-colors hover:border-accent"
          >
            <div className="aspect-[2/1] w-full shrink-0 overflow-hidden">
              {item.image && (
                <SafeImage
                  src={item.image}
                  alt=""
                  focus={item.focus}
                  slot="tile"
                  loading="lazy"
                  className="h-full w-full"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0 p-4">
              <p className="mb-1.5 text-xs text-muted-foreground">{formatDate(item.date)}</p>
              <p className="text-sm leading-snug text-foreground transition-colors group-hover:text-accent line-clamp-3">
                {item.title}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {news.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setActive(index)}
            aria-label={`Показать новость ${index + 1}`}
            className={`h-2 rounded-full transition-all ${index === active ? "w-5 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { items: managedNews, loading: newsLoading, error: newsError } = useManagedContent("news");
  const { items: managedBlocks, error: blocksError } = useManagedContent("visual_block");
  const blocks = Object.fromEntries((blocksError ? [] : managedBlocks).filter((item) => item.slug.startsWith("block:home:")).map((item) => [item.slug.replace("block:home:", ""), { title: item.title, summary: item.summary, tag: String(item.metadata.tag ?? ""), path: String(item.metadata.path ?? ""), image: item.image_url || undefined, hidden: item.metadata.hidden === true }])) as Record<string, HomeBlock>;
  const news: HomeNewsItem[] = managedNews.map((item) => ({
    id: item.slug,
    title: item.title,
    date: item.published_at,
    category: (item.category || "institute") as NewsCategory,
    excerpt: item.summary,
    body: item.body,
    image: item.image_url || undefined,
    tags: (item.metadata.tags as string[] | undefined) ?? [],
    featured: Boolean(item.metadata.featured),
    featuredOrder: Number(item.metadata.featuredOrder) || 999,
    focus: parseFocus(item.metadata.focus),
  }));
  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      {/* HERO */}
      <section className="bg-background py-5">
        <div className="max-w-[1280px] mx-auto px-4">
          {newsLoading ? <div role="status" className="min-h-[360px] rounded border border-border bg-card p-6 text-sm text-muted-foreground">Загрузка новостей...</div>
            : newsError ? <p role="alert" className="py-10 text-center text-sm text-muted-foreground">Не удалось загрузить новости. Обновите страницу.</p>
              : <HeroSlider news={news} blocks={blocks} />}
        </div>
      </section>

      {/* NEWS */}
      <section className="bg-background pb-5">
        <div className="max-w-[1280px] mx-auto px-4">
          <NewsCarousel news={news} />
        </div>
      </section>

      {/* НАУКА.РФ BANNER */}
      <section className="bg-background pb-5">
        <div className="max-w-[1280px] mx-auto px-4">
          <div className="rounded overflow-hidden bg-[#141830] text-white flex flex-col sm:flex-row">
            <div className="flex-1 p-6 flex flex-col justify-between gap-4">
              <div className="max-w-[70px] sm:max-w-[100px]">
                <img src={naukaRfLogo} alt="2022–2031 Десятилетие науки и технологий" className="w-full h-auto object-contain" />
              </div>
              <p className="text-[13px] text-gray-200 leading-relaxed">{blocks["science-left"]?.summary || "Президент России Владимир Путин объявил 2022–2031 гг. Десятилетием науки и технологий."}</p>
              <a
                href={blocks["science-left"]?.path || "https://наука.рф"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#1a4b8c] hover:bg-[#2a5faa] text-white text-sm font-semibold px-5 py-2.5 rounded transition-colors w-fit"
              >
                Узнай больше на <span className="text-[#7eb8f7]">наука.РФ</span>
              </a>
            </div>
            <div className="w-px bg-white/10 hidden sm:block" />
            <div className="flex-1 p-6 flex items-center bg-[#0f1225]">
              <p className="text-[13px] text-gray-300 leading-relaxed">{blocks["science-right"]?.summary || "Десятилетие науки и технологий включает комплекс инициатив, проектов и мероприятий — направленных на усиление роли науки в решении важнейших задач развития общества и страны."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACCESS */}
      <section className="bg-secondary py-8">
        <div className="max-w-[1280px] mx-auto px-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-5">Быстрый доступ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK_ACCESS_ITEMS.map((item) => <QuickAccessCard key={item.href} {...item} />)}
          </div>
        </div>
      </section>

    </div>
  );
}
