import { Link, useLocation } from "react-router";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  Library,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { useManagedContent, type ManagedContent } from "../lib/content";

const ASPIRANTURA_NAV = [
  { label: "Аспирантура", path: "/education" },
  { label: "Лицензия", path: "/education/license" },
  {
    label:
      "Правила приема в аспирантуру ФГБНУ «ИПИИ» по программам подготовки научных и научно-педагогических кадров в 2026/2027 учебном году",
    path: "/education/admission",
  },
  {
    label:
      "Контрольные цифры приема в аспирантуру ФГБНУ «ИПИИ» за счет бюджетных ассигнований федерального бюджета на 2026/27 учебный год",
    path: "/education/quota",
  },
  {
    label:
      "Положение о промежуточной аттестации, отчислении, восстановлении и переводе аспирантов ФГБНУ «ИПИИ»",
    path: "/education/attestation",
  },
  { label: "Вступительные испытания", path: "/education/exams" },
  { label: "Списки зачисленных", path: "/education/enrolled" },
  {
    label: "Об установлении стоимости платных образовательных услуг",
    path: "/education/fees",
  },
];

const DOCUMENTS = [
  "Фотография на документы в электронном виде на светлом фоне (деловой стиль) в формате JPG, не менее 300 точек на дюйм или 3 фотографии размером 3х4 с правым углом.",
  "Заявление на допуск к вступительным экзаменам.",
  "Документы, удостоверяющие личность и гражданство поступающего.",
  "Копии диплома специалиста или магистра и приложения к нему.",
  "Согласие на зачисление.",
  "Приложение 1 к заявлению: заключение предполагаемого научного руководителя по результатам собеседования.",
  "Приложение 2 к заявлению: портфолио, подтверждающее достижения поступающего в научной или научно-технической деятельности, с приложением подтверждающих документов.",
  "Согласие на обработку персональных данных.",
  "Анкета.",
  "Копия СНИЛС.",
  "Копии достижений или реферат по выбранному направлению подготовки с рецензией предполагаемого научного руководителя, не более 25 листов.",
  "При необходимости создания специальных условий при проведении вступительных испытаний: документ, подтверждающий ограниченные возможности здоровья или инвалидность.",
];

const LIBRARY_ITEMS = [
  "английский язык",
  "интеллектуальная собственность",
  "информатика и вычислительная техника",
  "искусственный интеллект",
  "научная этика",
  "распознавание речи",
  "робототехника",
  "стохастическая математика",
  "философия",
  "цифровая обработка сигнала",
  "и др.",
];

const DOWNLOAD_LINKS = {
  examProgram:
    "http://guiaidn.ru/downloads/%D0%9F%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%B0 %D0%B2%D1%81%D1%82%D1%83%D0%BF%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B3%D0%BE %D1%8D%D0%BA%D0%B7%D0%B0%D0%BC%D0%B5%D0%BD%D0%B0 %D0%B2 %D0%B0%D1%81%D0%BF%D0%B8%D1%80%D0%B0%D0%BD%D1%82%D1%83%D1%80%D1%83.docx",
  license:
    "http://guiaidn.ru/downloads/%D0%A0%D0%B5%D0%B5%D1%81%D1%82%D1%80%D0%BE%D0%B2%D0%B0%D1%8F %D0%B2%D1%8B%D0%BF%D0%B8%D1%81%D0%BA%D0%B0.pdf",
  quota: "http://guiaidn.ru/downloads/5_2.21.pdf",
  attestation:
    "http://guiaidn.ru/downloads/%D0%9F%D0%BE%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5_%D0%BE%D0%B1_%D0%B0%D1%82%D1%82%D0%B5%D1%81%D1%82%D0%B0%D1%86%D0%B8%D0%B8_%D0%A4%D0%93%D0%91%D0%9D%D0%A3_%D0%98%D0%9F%D0%98%D0%98_2023_1.pdf",
  libraryMega: "https://mega.nz/#F!iGxH0AzA!LlWi-U2u6IEmXBN0hPNcLw",
  libraryMail: "https://cloud.mail.ru/public/Jq3h/Pc5jjjuiU",
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Образование" }]} />
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-[1280px] mx-auto px-4 py-8">
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Образование
          </h1>
          <p className="text-sm text-blue-100 mt-2 max-w-3xl leading-relaxed">
            Аспирантура ФГБНУ «ИПИИ» и материалы библиотеки для подготовки
            научных и научно-педагогических кадров.
          </p>
        </div>
      </div>
      <main className="max-w-[1280px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function TopTabs({ pathname }: { pathname: string }) {
  const isLibrary = pathname === "/education/library";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      <Link
        to="/education"
        className={`flex items-center gap-3 border rounded p-4 transition-colors ${!isLibrary ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent"}`}
      >
        <GraduationCap size={22} className="text-primary" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-foreground">
            Аспирантура
          </div>
          <div className="text-xs text-muted-foreground">
            Поступление, испытания, зачисление, стоимость
          </div>
        </div>
      </Link>
      <Link
        to="/education/library"
        className={`flex items-center gap-3 border rounded p-4 transition-colors ${isLibrary ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent"}`}
      >
        <Library size={22} className="text-primary" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-foreground">
            Библиотека
          </div>
          <div className="text-xs text-muted-foreground">
            Материалы по учебным дисциплинам
          </div>
        </div>
      </Link>
    </div>
  );
}

function SideNav({ pathname }: { pathname: string }) {
  return (
    <aside className="w-full lg:w-[310px] shrink-0">
      <div className="bg-card border border-border rounded p-3 sticky top-28">
        <h2 className="text-xs font-bold uppercase tracking-widest text-primary px-2 py-2">
          Аспирантура
        </h2>
        <nav className="flex flex-col gap-1">
          {ASPIRANTURA_NAV.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-xs leading-snug rounded px-3 py-2 transition-colors ${pathname === item.path ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary hover:text-primary"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-bold text-primary mb-4"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm text-foreground leading-relaxed"
        >
          <span
            className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0"
            aria-hidden="true"
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function SimpleTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto border border-border rounded">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.join("-")}
              className={
                rowIndex === 0
                  ? "bg-primary text-primary-foreground"
                  : "border-t border-border"
              }
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AspiranturaHome() {
  return (
    <article className="space-y-6">
      <div className="bg-card border border-border rounded p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-accent mb-2">
          ФГБНУ «ИПИИ»
        </p>
        <h2
          className="text-2xl font-bold text-primary leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Приглашает на обучение в очную аспирантуру на 2026/2027 учебный год
        </h2>
        <p className="text-sm text-foreground leading-relaxed mt-3">
          По программам высшего образования - программам подготовки научных и
          научно-педагогических кадров по группе научных специальностей 2.3.
          Информационные технологии и телекоммуникации.
        </p>
        <div className="mt-4 bg-secondary border border-border rounded p-4">
          <div className="text-sm font-semibold text-foreground">
            Научная специальность 2.3.1.
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Системный анализ, управление и обработка информации, статистика - 2
            места.
          </div>
        </div>
      </div>

      <section>
        <SectionTitle>Порядок поступления</SectionTitle>
        <BulletList
          items={[
            "Поступающие в аспирантуру проходят собеседование с предполагаемым научным руководителем, оформляется протокол собеседования.",
            "Прием документов.",
            "Прием вступительного экзамена по специальной дисциплине «Системный анализ, управление и обработка информации, статистика» в форме устного экзамена.",
            "Зачисление по конкурсу.",
          ]}
        />
      </section>

      <section>
        <SectionTitle>Перечень документов для поступления</SectionTitle>
        <p className="text-sm text-muted-foreground mb-3">
          Документы подаются на русском языке.
        </p>
        <BulletList items={DOCUMENTS} />
        <p className="text-sm text-foreground leading-relaxed mt-3">
          Документ, удостоверяющий личность, и диплом установленного образца
          поступающие в аспирантуру представляют лично.
        </p>
      </section>

      <section>
        <SectionTitle>Прием документов</SectionTitle>
        <div className="space-y-3 text-sm text-foreground leading-relaxed">
          <p>
            Поступающий подает заявления о приеме и документы, необходимые для
            поступления, посредством федеральной государственной информационной
            системы «Единый портал государственных и муниципальных услуг
            (функций)».
          </p>
          <p>
            Также прием документов осуществляется по предварительной
            договоренности лично по адресу: 283048, ДНР, г.о. Донецк, г. Донецк,
            ул. Артема, д. 118б, ФГБНУ «ИПИИ», Приемная комиссия.
          </p>
          <p>
            Поступающие вправе направить заявление и документы через операторов
            почтовой связи общего пользования почтовым отправлением с
            уведомлением о вручении и описью вложения в адрес Приемной комиссии.
          </p>
          <p>
            Поступающий обязан уведомить Приемную комиссию об отправке
            документов через операторов почтовой связи по электронной почте{" "}
            <a
              href="mailto:aspirantura.ipai@yandex.ru"
              className="text-accent hover:underline"
            >
              aspirantura.ipai@yandex.ru
            </a>
            .
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Этапы вступительной кампании</SectionTitle>
        <SimpleTable
          rows={[
            ["Этапы вступительной кампании", "Сроки"],
            ["Прием документов", "01 июня - 20 августа 2026 г."],
            ["Проведение вступительных испытаний", "26 августа 2026 г."],
            ["Зачисление на обучение", "31 августа 2026 г."],
          ]}
        />
        <p className="mt-3 text-sm font-semibold text-primary">
          Внимание! Сроки приема документов могут быть изменены, следите за
          обновлениями.
        </p>
      </section>

      <ContactPanel />
    </article>
  );
}

function ExamsContent() {
  return (
    <article className="space-y-6">
      <section>
        <SectionTitle>Вступительные испытания</SectionTitle>
        <div className="space-y-3 text-sm text-foreground leading-relaxed">
          <p>
            Вступительные испытания рассчитаны на уровень знаний,
            соответствующий уровню специалитета или магистратуры в рамках
            выбранной научной специальности, в том числе и уровню знания
            иностранного языка. Все вступительные испытания проводятся на
            русском языке.
          </p>
          <h3 className="text-base font-semibold text-foreground">
            Вступительное испытание по специальности
          </h3>
          <p>
            Вступительное испытание по специальности проводится в устной форме.
            Каждый билет состоит из трех вопросов, соответствующих научной
            специальности. Поступающему дается время на подготовку не менее 1
            академического часа.
          </p>
          <p>
            После ответа на билет экзаменатор вправе задать поступающему
            несколько дополнительных вопросов. Шкала оценивания - пятибалльная.
          </p>
          <p>
            Для выполнения задания поступающему выдается черновик. Черновики
            выполненных заданий не проверяются и не являются предметом
            апелляции. После проведения экзамена черновики сдаются в Приемную
            комиссию.
          </p>
        </div>
      </section>
      <section className="bg-secondary border border-border rounded p-4">
        <h3 className="text-sm font-bold text-primary mb-2">
          Расписание вступительных испытаний
        </h3>
        <p className="text-sm text-foreground">Дата: 25 августа 2025 г.</p>
        <p className="text-sm text-foreground">Время: 10 час. 00 мин.</p>
        <p className="text-sm text-foreground">
          Место проведения: ФГБНУ «ИПИИ», кабинет 20.
        </p>
      </section>
      <a
        href={DOWNLOAD_LINKS.examProgram}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors"
      >
        Скачать «Программу вступительного экзамена в аспирантуру»{" "}
        <FileText size={15} aria-hidden="true" />
      </a>
    </article>
  );
}

function EnrolledContent() {
  return (
    <article className="space-y-5">
      <SectionTitle>Списки зачисленных</SectionTitle>
      <p className="text-sm text-foreground">
        Зачислены в аспирантуру с 01.09.2025.
      </p>
      <p className="text-sm font-semibold text-foreground">
        2.3.1. Системный анализ, управление и обработка информации, статистика
      </p>
      <SimpleTable
        rows={[
          ["№ п/п", "Уникальный идентификатор поступающего"],
          ["1.", "5157011"],
          ["2.", "5027499"],
        ]}
      />
    </article>
  );
}

function FeesContent() {
  return (
    <article className="space-y-6">
      <SectionTitle>
        Об установлении стоимости платных образовательных услуг
      </SectionTitle>
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          Плата за обучение поступающих на первый курс в 2026/2027 учебном году
          (набор 2026 г.)
        </h3>
        <p className="text-sm text-foreground leading-relaxed">
          В соответствии с федеральным законодательством, нормативными затратами
          на оказание государственных услуг, решением Ученого совета ФГБНУ
          «ИПИИ» от 12.03.2026 г. и сметой расходов на 2026 год установлена
          следующая стоимость с 01.09.2026 г. для поступающих сверх контрольных
          цифр приема:
        </p>
        <SimpleTable
          rows={[
            [
              "Научная специальность",
              "Форма обучения",
              "Нормативный срок",
              "Стоимость в год, руб.",
              "Полная стоимость, руб.",
            ],
            [
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
              "очная",
              "3 года",
              "1 курс - 205 440,00; 2 курс - 219 960,00; 3 курс - 234 036,00",
              "659 436,00",
            ],
          ]}
        />
      </section>
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          Набор 2025 г.
        </h3>
        <SimpleTable
          rows={[
            [
              "Научная специальность",
              "Форма обучения",
              "Нормативный срок",
              "Стоимость в год, руб.",
              "Полная стоимость, руб.",
            ],
            [
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
              "очная",
              "3 года",
              "1 курс - 198 000,00; 2 курс - 208 980,00; 3 курс - 212 772,00",
              "619 752,00",
            ],
          ]}
        />
      </section>
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          Набор 2024 г.
        </h3>
        <SimpleTable
          rows={[
            [
              "Научная специальность",
              "Форма обучения",
              "Нормативный срок",
              "Стоимость в год, руб.",
              "Полная стоимость, руб.",
            ],
            [
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
              "очная",
              "3 года",
              "1 курс - 182 400,00; 2 курс - 192 000,00; 3 курс - 192 000,00",
              "566 400,00",
            ],
          ]}
        />
      </section>
      <p className="text-sm text-accent">
        О возможности получения образовательного кредита с государственной
        поддержкой.
      </p>
    </article>
  );
}

function DocumentOnlyContent({
  title,
  downloadUrl,
}: {
  title: string;
  downloadUrl?: string;
}) {
  return (
    <article className="space-y-4">
      <SectionTitle>{title}</SectionTitle>
      <div className="bg-card border border-border rounded p-5">
        <div className="flex items-start gap-3">
          <FileText
            size={22}
            className="text-primary shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm text-foreground leading-relaxed">
            Материал размещается в составе подраздела «Аспирантура». Для
            получения актуальной версии документа обратитесь в приемную комиссию
            ФГБНУ «ИПИИ».
          </p>
        </div>
      </div>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors"
        >
          Скачать документ <FileText size={15} aria-hidden="true" />
        </a>
      )}
      <ContactPanel />
    </article>
  );
}

function ContactPanel() {
  return (
    <section className="bg-card border border-border rounded p-5">
      <h3 className="text-sm font-bold text-primary mb-3">Приемная комиссия</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-foreground">
        <p className="flex items-start gap-2">
          <MapPin
            size={15}
            className="text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />{" "}
          г. Донецк, ул. Артема, д. 118Б, каб. 20
        </p>
        <p className="flex items-start gap-2">
          <BookOpen
            size={15}
            className="text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />{" "}
          Начало занятий - 01 сентября 2026 г.
        </p>
        <p className="flex items-start gap-2">
          <Phone
            size={15}
            className="text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />{" "}
          +7 (949) 439-76-82, +7 (949) 347-21-05
        </p>
        <p className="flex items-start gap-2">
          <Mail
            size={15}
            className="text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />{" "}
          <a
            href="mailto:aspirantura.ipai@yandex.ru"
            className="text-accent hover:underline"
          >
            aspirantura.ipai@yandex.ru
          </a>
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Время работы: с 10:00 до 16:00.
      </p>
    </section>
  );
}

function LibraryContent() {
  return (
    <article className="space-y-6">
      <SectionTitle>Библиотека</SectionTitle>
      <p className="text-sm text-foreground leading-relaxed">
        Материалы библиотеки по следующим дисциплинам:
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LIBRARY_ITEMS.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 bg-card border border-border rounded px-3 py-2 text-sm text-foreground"
          >
            <BookOpen
              size={14}
              className="text-primary shrink-0"
              aria-hidden="true"
            />
            {item}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={DOWNLOAD_LINKS.libraryMega}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-primary text-primary-foreground rounded p-4 hover:bg-accent transition-colors"
        >
          <span className="text-sm font-semibold">Библиотека-MEGA</span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <a
          href={DOWNLOAD_LINKS.libraryMail}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-primary text-primary-foreground rounded p-4 hover:bg-accent transition-colors"
        >
          <span className="text-sm font-semibold">Библиотека MAIL-Облако</span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function DynamicEducationBlock({ block }: { block: ManagedContent }) {
  const tuitionTables = block.metadata.tuitionTables as
    | Array<{
        id: string;
        title: string;
        description: string;
        rows: Array<{
          specialty: string;
          studyForm: string;
          duration: string;
          yearlyCost: string;
          totalCost: string;
        }>;
      }>
    | undefined;
  const tuitionRows = block.metadata.tableRows as
    | Array<{
        specialty: string;
        studyForm: string;
        duration: string;
        yearlyCost: string;
        totalCost: string;
      }>
    | undefined;
  const tuitionTable =
    tuitionRows && tuitionRows.length > 0
      ? [
          [
            "Научная специальность",
            "Форма обучения",
            "Нормативный срок",
            "Стоимость в год, руб.",
            "Полная стоимость, руб.",
          ],
          ...tuitionRows.map((row) => [
            row.specialty,
            row.studyForm,
            row.duration,
            row.yearlyCost,
            row.totalCost,
          ]),
        ]
      : null;
  return (
    <article className="space-y-5">
      <SectionTitle>{block.title}</SectionTitle>
      {!tuitionTables && !tuitionTable && block.summary && (
        <p className="text-base font-medium text-muted-foreground leading-relaxed whitespace-pre-line">
          {block.summary}
        </p>
      )}
      {tuitionTables && tuitionTables.length > 0 ? (
        tuitionTables.map((table) => {
          const rows = [
            [
              "Научная специальность",
              "Форма обучения",
              "Нормативный срок",
              "Стоимость в год, руб.",
              "Полная стоимость, руб.",
            ],
            ...table.rows.map((row) => [
              row.specialty,
              row.studyForm,
              row.duration,
              row.yearlyCost,
              row.totalCost,
            ]),
          ];
          return (
            <section key={table.id} className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                {table.title}
              </h3>
              {table.description && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {table.description}
                </p>
              )}
              <SimpleTable rows={rows} />
            </section>
          );
        })
      ) : tuitionTable ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {String(block.metadata.tableTitle ?? "Стоимость обучения")}
          </h3>
          <SimpleTable rows={tuitionTable} />
        </section>
      ) : (
        block.body && (
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
            {block.body}
          </div>
        )
      )}
      {block.image_url && (
        <img
          src={block.image_url}
          alt=""
          className="w-full max-h-[420px] object-cover rounded border border-border"
        />
      )}
      {block.file_url && (
        <a
          href={block.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-accent text-accent-foreground text-sm px-4 py-2.5 rounded hover:bg-primary transition-colors"
        >
          <FileText size={16} /> Скачать актуальный документ
        </a>
      )}
      <ContactPanel />
    </article>
  );
}

function AspiranturaContent({
  pathname,
  blocks,
}: {
  pathname: string;
  blocks: ManagedContent[];
}) {
  const managedSlug =
    pathname === "/education/fees"
      ? "block:education:fees"
      : pathname === "/education"
        ? "block:education:aspirantura"
        : "";
  const managedBlock = blocks.find((item) => item.slug === managedSlug);
  if (managedBlock) return <DynamicEducationBlock block={managedBlock} />;
  if (pathname === "/education/exams") return <ExamsContent />;
  if (pathname === "/education/enrolled") return <EnrolledContent />;
  if (pathname === "/education/fees") return <FeesContent />;
  if (pathname === "/education/license")
    return (
      <DocumentOnlyContent
        title="Лицензия"
        downloadUrl={DOWNLOAD_LINKS.license}
      />
    );
  if (pathname === "/education/quota")
    return (
      <DocumentOnlyContent
        title="Контрольные цифры приема в аспирантуру ФГБНУ «ИПИИ» за счет бюджетных ассигнований федерального бюджета на 2026/27 учебный год"
        downloadUrl={DOWNLOAD_LINKS.quota}
      />
    );
  if (pathname === "/education/attestation")
    return (
      <DocumentOnlyContent
        title="Положение о промежуточной аттестации, отчислении, восстановлении и переводе аспирантов ФГБНУ «ИПИИ»"
        downloadUrl={DOWNLOAD_LINKS.attestation}
      />
    );
  return <AspiranturaHome />;
}

export default function EducationPage() {
  const { pathname } = useLocation();
  const { items: managedBlocks } = useManagedContent("visual_block");
  const isLibrary = pathname === "/education/library";

  return (
    <PageShell>
      <TopTabs pathname={pathname} />
      {isLibrary ? (
        <LibraryContent />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <SideNav pathname={pathname} />
          <div className="flex-1 min-w-0">
            <AspiranturaContent pathname={pathname} blocks={managedBlocks} />
          </div>
        </div>
      )}
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          На главную <ChevronRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </PageShell>
  );
}
