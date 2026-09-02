import { Link, useLocation } from "react-router";
import { ChevronRight, FlaskConical, GraduationCap, FileText, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { NEWS, formatDate } from "../data";

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
    image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=400&fit=crop&auto=format",
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
        <img
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
