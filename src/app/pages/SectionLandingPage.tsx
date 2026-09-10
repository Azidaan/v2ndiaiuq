import { Link, useLocation } from "react-router";
import { Building2, ChevronRight, Download, FlaskConical, GraduationCap, FileText, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { NEWS, formatDate } from "../data";
import { useManagedContent } from "../lib/content";
import SafeImage from "../components/ui/SafeImage";

/** Запасные значения на случай пустой базы: те же, что в визуальном редакторе. */
const REQUISITES_FALLBACK = {
  fullName:
    "Федеральное государственное бюджетное научное учреждение «Институт проблем искусственного интеллекта»",
  shortName: "ФГБНУ «ИПИИ»",
  address: "283048, ДНР, г. Донецк, ул. Артема, д. 118б",
};

interface SectionConfig {
  title: string;
  subtitle: string;
  image: string;
  breadcrumb: string;
  links: { label: string; path: string; description: string }[];
  newsFilter?: string;
}

const SECTIONS: Record<string, SectionConfig> = {
  "/institute": {
    title: "Об институте",
    subtitle: "Федеральное государственное бюджетное научное учреждение «Институт проблем искусственного интеллекта» — ведущий российский исследовательский центр в области ИИ.",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop&auto=format",
    breadcrumb: "Институт",
    links: [
      { label: "История и миссия", path: "/institute/history", description: "Основание, этапы развития и научная миссия института" },
      { label: "Научные отделы", path: "/institute/departments", description: "8 лабораторий и научных подразделений" },
      { label: "Контакты", path: "/contacts", description: "Адрес, телефоны, форма обращения" },
    ],
  },
  "/science": {
    title: "Наука",
    subtitle: "Фундаментальные и прикладные исследования в области искусственного интеллекта, машинного обучения, обработки естественного языка и компьютерного зрения.",
    image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1200&h=400&fit=crop&auto=format",
    breadcrumb: "Наука",
    links: [
      { label: "Исследования и разработки", path: "/science/research", description: "Текущие проекты и разработки" },
      { label: "Свидетельства о государственной регистрации программы для ЭВМ", path: "/science/rid", description: "Зарегистрированные программы для ЭВМ и свидетельства" },
    ],
    newsFilter: "science",
  },
  "/education": {
    title: "Образование",
    subtitle: "Подготовка высококвалифицированных исследователей в области ИИ. Аспирантура по направлению 1.2.1 «Искусственный интеллект и машинное обучение».",
    image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&h=400&fit=crop&auto=format",
    breadcrumb: "Образование",
    links: [
      { label: "Аспирантура", path: "/education", description: "Направления подготовки и сроки обучения" },
      { label: "Правила приёма", path: "/education/admission", description: "Порядок и условия приёма в аспирантуру" },
      { label: "Вступительные испытания", path: "/education/exams", description: "Перечень испытаний и программы" },
      { label: "Стоимость обучения", path: "/education/fees", description: "Тарифы платного обучения" },
      { label: "Списки зачисления", path: "/education/enrolled", description: "Приказы о зачислении" },
      { label: "Целевое обучение", path: "/education/targeted", description: "Целевой приём от организаций" },
    ],
    newsFilter: "education",
  },
  "/publications": {
    title: "Публикации и журнал",
    subtitle: "Научные труды сотрудников, ежеквартальный журнал «Проблемы искусственного интеллекта» и сборники материалов конференций.",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&h=400&fit=crop&auto=format",
    breadcrumb: "Публикации",
    links: [
      { label: "Публикации сотрудников", path: "/publications", description: "Статьи, монографии, материалы конференций" },
      { label: "Публикации по годам", path: "/publications/archive", description: "Архив публикаций с 2010 года" },
      { label: "Журнал «Проблемы ИИ»", path: "/publications/journal", description: "Ежеквартальный рецензируемый журнал (ВАК К2)" },
      { label: "Сборники ДМКС-ИИ", path: "/publications/collections", description: "Материалы круглых столов" },
    ],
  },
  "/documents": {
    title: "Документы",
    subtitle: "Учредительные и нормативные документы, отчёты о деятельности, материалы по противодействию коррупции.",
    image: "https://images.unsplash.com/photo-1568219557405-376e23e4f7cf?w=1200&h=400&fit=crop&auto=format",
    breadcrumb: "Документы",
    links: [
      { label: "Учредительные документы", path: "/documents/charter", description: "Устав и свидетельства о регистрации" },
      { label: "Нормативные документы", path: "/documents/normative", description: "Положения, регламенты, правила" },
      { label: "Отчёты", path: "/documents/reports", description: "Годовые отчёты и отчёты по госзаданию" },
      { label: "Антикоррупция", path: "/documents/anticorruption", description: "Политика, сведения о доходах, кодекс этики" },
      { label: "Политика обработки данных", path: "/documents/privacy", description: "Порядок обработки персональных данных" },
    ],
  },
};

const SECTION_ICONS: Record<string, LucideIcon> = {
  "/institute": FlaskConical,
  "/science": FlaskConical,
  "/education": GraduationCap,
  "/publications": BookOpen,
  "/documents": FileText,
};

export default function SectionLandingPage() {
  const { pathname } = useLocation();
  const basePath = "/" + pathname.split("/")[1];
  const config = SECTIONS[basePath];

  if (!config) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Раздел не найден</h1>
        <Link to="/" className="text-accent hover:underline text-sm">← На главную</Link>
      </div>
    );
  }

  const Icon = SECTION_ICONS[basePath] || ChevronRight;
  const relatedNews = config.newsFilter
    ? NEWS.filter((n) => n.category === config.newsFilter).slice(0, 3)
    : NEWS.slice(0, 3);

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: config.breadcrumb }]} />

      {/* Hero banner */}
      <div className="relative h-52 sm:h-64 bg-primary overflow-hidden">
        <SafeImage
          src={config.image}
          alt={config.title}
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 flex items-end pb-8 px-4">
          <div className="max-w-[1280px] mx-auto w-full">
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {config.title}
            </h1>
            <p className="text-sm text-blue-200 mt-2 max-w-2xl leading-relaxed">{config.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Section nav cards */}
          <div className="flex-1 min-w-0">
            {basePath === "/institute" && <InstituteDetails />}
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">В этом разделе</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex items-start gap-3 bg-card border border-border rounded p-4 hover:border-accent hover:shadow-sm group transition-all"
                >
                  <div className="w-8 h-8 shrink-0 rounded bg-secondary flex items-center justify-center mt-0.5 group-hover:bg-primary transition-colors">
                    <Icon size={16} className="text-primary group-hover:text-white transition-colors" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-foreground group-hover:text-accent transition-colors">
                      {link.label}
                    </h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{link.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-accent shrink-0 self-center ml-auto" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar: related news */}
          <aside className="w-full lg:w-[260px] shrink-0">
            <div className="bg-card border border-border rounded p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Новости раздела</h2>
              <div className="flex flex-col gap-3">
                {relatedNews.map((n) => (
                  <Link
                    key={n.id}
                    to={`/news/${n.id}`}
                    className="group block border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <p className="text-[10px] text-muted-foreground mb-0.5">{formatDate(n.date)}</p>
                    <p className="text-[12px] text-foreground group-hover:text-accent transition-colors leading-snug">
                      {n.title}
                    </p>
                  </Link>
                ))}
              </div>
              <Link to="/news" className="text-xs text-accent hover:underline flex items-center gap-1 mt-3">
                Все новости <ChevronRight size={11} aria-hidden="true" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/**
 * Сведения об организации и учредительные документы на странице «Институт».
 * Реквизиты редактируются в визуальном редакторе CMS (block:institute:requisites),
 * документы — в разделе «Документы» с категорией «Учредительные».
 * Компонент монтируется только на /institute, поэтому запросы не идут с других разделов.
 */
function InstituteDetails() {
  const { items: blocks, error: blocksError } = useManagedContent("visual_block");
  const { items: documents, error: documentsError } = useManagedContent("document");

  const stored = blocksError
    ? undefined
    : blocks.find((item) => item.slug === "block:institute:requisites")?.metadata;
  const text = (key: keyof typeof REQUISITES_FALLBACK) => {
    const value = stored?.[key];
    return typeof value === "string" && value.trim() ? value : REQUISITES_FALLBACK[key];
  };

  const charter = documentsError
    ? []
    : documents
        .filter((item) => item.category === "charter")
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Сведения об организации
      </h2>
      <dl className="rounded border border-border bg-card divide-y divide-border">
        {[
          { term: "Полное наименование", value: text("fullName") },
          { term: "Сокращённое наименование", value: text("shortName") },
          { term: "Адрес", value: text("address") },
        ].map((row) => (
          <div key={row.term} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
            <dt className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-56">
              {row.term}
            </dt>
            <dd className="text-sm leading-relaxed text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Учредительные документы
      </h2>
      {charter.length === 0 ? (
        <p className="rounded border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          Учредительные документы пока не добавлены.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {charter.map((item) => {
            const extension = (item.file_url.split(".").pop() ?? "").toUpperCase();
            const content = (
              <>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary">
                  <Building2 size={16} className="text-primary" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground group-hover:text-accent">
                    {item.title}
                  </span>
                  {item.summary && (
                    <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                      {item.summary}
                    </span>
                  )}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatDate(item.published_at)}
                    {extension && ` · ${extension}`}
                  </span>
                </span>
                {item.file_url && (
                  <Download size={15} className="mt-1 shrink-0 text-muted-foreground group-hover:text-accent" aria-hidden="true" />
                )}
              </>
            );
            const className =
              "group flex gap-3 rounded border border-border bg-card p-4 transition-all hover:border-accent hover:shadow-sm";
            return (
              <li key={item.id}>
                {item.file_url ? (
                  <a href={item.file_url} target="_blank" rel="noreferrer" className={className}>
                    {content}
                  </a>
                ) : (
                  <div className={className}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
