import { Download, FileText } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { useManagedContent } from "../lib/content";
import { toManagedCertificates } from "../features/science/managedScienceContent";

export interface Certificate {
  year: string;
  number: string;
  title: string;
  application: string;
  filed: string;
  published: string;
  authors: string;
  url?: string;
  extra?: string;
}

export const CERTIFICATES: Certificate[] = [
  {
    year: "2025",
    number: "2025611192",
    title: "Программа для диагностирования психоэмоциональных состояний личности",
    application: "2024693208",
    filed: "26.12.2024",
    published: "16.01.2025",
    authors: "Бондарчук В. В., Кравченко Н. М., Клюшанова Т. Д., Ковалева К. В.",
    url: "http://guiaidn.ru/downloads/2025611192.eod.pdf",
  },
  {
    year: "2025",
    number: "2025611191",
    title: "Экспериментальное программное обеспечение для морфологической разметки текста со снятием омонимии",
    application: "2024693205",
    filed: "26.12.2024",
    published: "16.01.2025",
    authors: "Шелепов В. Ю., Ниценко А. В., Большакова С. А.",
    url: "http://guiaidn.ru/downloads/2025611191.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696735",
    title: "Компьютерная программа для предсказания углов положения БПЛА",
    application: "2025696137",
    filed: "19.12.2025",
    published: "19.12.2025",
    authors: "Павленко Б. В.",
    url: "http://guiaidn.ru/downloads/2025696735.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696751",
    title: "Компьютерная система расширения данных аэрофотоснимков AugUAV",
    application: "2025696159",
    filed: "19.12.2025",
    published: "19.12.2025",
    authors: "Пикалёв Я. С., Устенко В. Ю.",
    url: "http://guiaidn.ru/downloads/2025696751.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696746",
    title: "Компьютерная программа EyePACS-ODR",
    application: "2025696151",
    filed: "19.12.2025",
    published: "19.12.2025",
    authors: "Пикалёв Я. С., Полякова В. Е.",
    url: "http://guiaidn.ru/downloads/2025696746.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696740",
    title: "Программа генерации синтетических аэрофотоснимков БПЛА",
    application: "2025696145",
    filed: "19.12.2025",
    published: "19.12.2025",
    authors: "Пикалёв Я. С., Близно М. В.",
    url: "http://guiaidn.ru/downloads/2025696740.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696995",
    title: "Программа для диагностирования психоэмоционального состояния и немедикаментозной регуляции",
    application: "2025696409",
    filed: "22.12.2025",
    published: "22.12.2025",
    authors: "Бондарчук В. В., Кравченко Н. М., Клюшанова Т. Д., Ковалева К. В.",
    url: "http://guiaidn.ru/downloads/2025696995.eod.pdf",
  },
  {
    year: "2025",
    number: "2025696999",
    title: "Web-cервис онлайн-консультирования СпросиИИ",
    application: "2025696415",
    filed: "22.12.2025",
    published: "22.12.2025",
    authors: "Дорохина Г. В., Долженко Р. А., Левашов А. А., Прасолова В. Ю.",
    url: "http://guiaidn.ru/downloads/2025696999.eod.pdf",
  },
  {
    year: "2025",
    number: "2025697100",
    title: "Программный комплекс для математического моделирования процесса ускоренного охлаждения металлопроката",
    application: "2025696565",
    filed: "23.12.2025",
    published: "23.12.2025",
    authors: "Пшекоп В. Ю.",
    url: "http://guiaidn.ru/downloads/2025697100.eod.pdf",
  },
  {
    year: "2025",
    number: "2025697102",
    title: "Программный комплекс для визуализации и моделирования полёта БПЛА в выбранном участке поверхности Земли",
    application: "2025696570",
    filed: "23.12.2025",
    published: "23.12.2025",
    authors: "Тахтай В. В.",
    url: "http://guiaidn.ru/downloads/2025697102.eod.pdf",
  },
  {
    year: "2024",
    number: "2024610632",
    title: "Программный комплекс распознавания объектов по их изображению с использованием дискретного косинусного преобразования (ДКП)",
    application: "2023689793",
    filed: "29.12.2023",
    published: "12.01.2024",
    authors: "Близно М. В.",
    extra: "EDN RYWAVE.",
  },
  {
    year: "2024",
    number: "2025611219",
    title: "Программный комплекс для автоматизированного сбора аэрофотоснимков",
    application: "2024693206",
    filed: "26.12.2024",
    published: "17.12.2025",
    authors: "Павленко Б. В.",
    url: "http://guiaidn.ru/downloads/2025611219.eod.pdf",
  },
  {
    year: "2024",
    number: "2024692372",
    title: "Программный комплекс сравнения детекторов изображений",
    application: "2024692372",
    filed: "27.12.2024",
    published: "27.12.2024",
    authors: "Зуев В. М.",
    url: "http://guiaidn.ru/downloads/2024692372.eod.pdf",
  },
  {
    year: "2024",
    number: "2024692389",
    title: "Программный комплекс для аннотирования данных",
    application: "2024692488",
    filed: "28.12.2024",
    published: "28.12.2024",
    authors: "Устенко В. Ю.",
    url: "http://guiaidn.ru/downloads/2024692389.eod.pdf",
  },
];

function CertificateCard({ item }: { item: Certificate }) {
  return (
    <article className="bg-card border border-border rounded p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded bg-secondary flex items-center justify-center">
          <FileText size={18} className="text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">№ {item.number}</p>
          <h2 className="text-sm font-semibold text-foreground leading-snug mt-1">{item.title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>Заявка: {item.application}</span>
        <span>Заявлено: {item.filed}</span>
        <span>Опубликовано: {item.published}</span>
      </div>
      <p className="text-xs text-foreground leading-relaxed">
        Авторы: {item.authors}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Заявитель: Федеральное государственное бюджетное научное учреждение «Институт проблем искусственного интеллекта».
      </p>
      {item.extra && <p className="text-xs text-muted-foreground">{item.extra}</p>}
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors w-fit mt-auto"
        >
          Скачать свидетельство <Download size={15} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export default function ScienceCertificatesPage() {
  const { items: managedItems, error } = useManagedContent("certificate");
  const certificates: Certificate[] = !error && managedItems.length > 0
    ? toManagedCertificates(managedItems)
    : CERTIFICATES;
  const years = Array.from(new Set(certificates.map((item) => item.year))).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Наука", path: "/science" }, { label: "Свидетельства" }]} />
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-[1280px] mx-auto px-4 py-8">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-2">Раздел «Наука»</p>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Свидетельства о государственной регистрации программы для ЭВМ
          </h1>
          <p className="text-sm text-blue-100 mt-2 max-w-3xl leading-relaxed">
            Ключевая информация о зарегистрированных программах для ЭВМ ФГБНУ «ИПИИ» и ссылки для скачивания свидетельств.
          </p>
        </div>
      </div>
      <main className="max-w-[1280px] mx-auto px-4 py-6 space-y-8">
        {years.map((year) => (
          <section key={year}>
            <h2 className="text-xl font-bold text-primary mb-4" style={{ fontFamily: "var(--font-display)" }}>{year}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {certificates.filter((item) => item.year === year).map((item) => (
                <CertificateCard key={item.number} item={item} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
