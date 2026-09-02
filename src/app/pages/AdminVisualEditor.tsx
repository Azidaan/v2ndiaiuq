import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  MousePointer2,
  Newspaper,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { ManagedContent } from "../lib/content";
import { contentRepository } from "../lib/contentRepository";
import { fileStorage } from "../lib/fileStorage";
import { sanitizeHtml } from "../lib/sanitize";

type EditableBlock = {
  slug: string;
  label: string;
  title: string;
  summary: string;
  body: string;
  tag: string;
  path: string;
  image_url: string;
  file_url: string;
  tableTitle?: string;
  tableRows?: TuitionRow[];
  tuitionTables?: TuitionTable[];
};

type TuitionRow = {
  specialty: string;
  studyForm: string;
  duration: string;
  yearlyCost: string;
  totalCost: string;
};

type TuitionTable = {
  id: string;
  title: string;
  description: string;
  rows: TuitionRow[];
};

const DEFAULT_BLOCKS: EditableBlock[] = [
  {
    slug: "block:home:program",
    label: "Карточка «Программа»",
    tag: "ПРОГРАММА",
    title: "ДМКС-ИИ-2026: Международный круглый стол по ИИ в Донецке",
    summary: "",
    body: "",
    path: "/science/dmks",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:home:journal",
    label: "Карточка «Журнал»",
    tag: "ЖУРНАЛ",
    title: "«Проблемы ИИ» включён в Перечень ВАК К2 — «Белый список»",
    summary: "",
    body: "",
    path: "/publications/journal",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:home:congratulations",
    label: "Карточка «Поздравляем»",
    tag: "ПОЗДРАВЛЯЕМ!",
    title: "Выпуск журнала ИПИИ №2 (28) 2026 года вышел в свет",
    summary: "",
    body: "",
    path: "/publications/journal",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:home:science-left",
    label: "Наука.РФ — левая часть",
    tag: "НАУКА.РФ",
    title: "Десятилетие науки и технологий",
    summary:
      "Президент России объявил 2022–2031 гг. Десятилетием науки и технологий.",
    body: "",
    path: "https://наука.рф",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:home:science-right",
    label: "Наука.РФ — правая часть",
    tag: "О ПРОЕКТЕ",
    title: "",
    summary:
      "Десятилетие науки и технологий включает комплекс инициатив, проектов и мероприятий, направленных на усиление роли науки.",
    body: "",
    path: "",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:education:aspirantura",
    label: "Аспирантура — актуальная информация",
    tag: "ФГБНУ «ИПИИ»",
    title:
      "Приглашает на обучение в очную аспирантуру на 2026/2027 учебный год",
    summary:
      "По программам высшего образования — программам подготовки научных и научно-педагогических кадров по группе научных специальностей 2.3. Информационные технологии и телекоммуникации.",
    body: `Научная специальность 2.3.1.
Системный анализ, управление и обработка информации, статистика — 2 места.

ПОРЯДОК ПОСТУПЛЕНИЯ
• Собеседование с предполагаемым научным руководителем и оформление протокола.
• Приём документов.
• Вступительный экзамен по специальной дисциплине «Системный анализ, управление и обработка информации, статистика» в форме устного экзамена.
• Зачисление по конкурсу.

ПРИЁМ ДОКУМЕНТОВ
Документы подаются на русском языке через Единый портал государственных и муниципальных услуг, лично по предварительной договорённости или почтовым отправлением.
Адрес: 283048, ДНР, г. Донецк, ул. Артема, д. 118б, ФГБНУ «ИПИИ», Приёмная комиссия.
Электронная почта: aspirantura.ipai@yandex.ru.

ЭТАПЫ ВСТУПИТЕЛЬНОЙ КАМПАНИИ
Приём документов: 01 июня — 20 августа 2026 г.
Вступительные испытания: 26 августа 2026 г.
Зачисление на обучение: 31 августа 2026 г.

Внимание! Сроки приёма документов могут быть изменены, следите за обновлениями.

Приёмная комиссия: +7 (949) 439-76-82, +7 (949) 347-21-05.
Начало занятий: 01 сентября 2026 г.`,
    path: "/education",
    image_url: "",
    file_url: "",
  },
  {
    slug: "block:education:fees",
    label: "Стоимость платных образовательных услуг",
    tag: "СТОИМОСТЬ ОБУЧЕНИЯ",
    title: "Об установлении стоимости платных образовательных услуг",
    summary:
      "Стоимость обучения по научной специальности 2.3.1. «Системный анализ, управление и обработка информации, статистика», очная форма, нормативный срок обучения — 3 года.",
    body: `НАБОР 2026 ГОДА
1 курс — 205 440,00 руб.
2 курс — 219 960,00 руб.
3 курс — 234 036,00 руб.
Полная стоимость — 659 436,00 руб.

Стоимость установлена с 01.09.2026 г. для поступающих сверх контрольных цифр приёма в соответствии с решением Учёного совета ФГБНУ «ИПИИ» от 12.03.2026 г. и сметой расходов на 2026 год.

НАБОР 2025 ГОДА
1 курс — 198 000,00 руб.
2 курс — 208 980,00 руб.
3 курс — 212 772,00 руб.
Полная стоимость — 619 752,00 руб.

НАБОР 2024 ГОДА
1 курс — 182 400,00 руб.
2 курс — 192 000,00 руб.
3 курс — 192 000,00 руб.
Полная стоимость — 566 400,00 руб.

Возможно получение образовательного кредита с государственной поддержкой.`,
    path: "/education/fees",
    image_url: "",
    file_url: "",
    tuitionTables: [
      {
        id: "tuition-2026",
        title:
          "Плата за обучение поступающих на первый курс в 2026/2027 учебном году (набор 2026 г.)",
        description:
          "Стоимость установлена с 01.09.2026 г. для поступающих сверх контрольных цифр приёма в соответствии с решением Учёного совета ФГБНУ «ИПИИ» от 12.03.2026 г. и сметой расходов на 2026 год.",
        rows: [
          {
            specialty:
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
            studyForm: "очная",
            duration: "3 года",
            yearlyCost:
              "1 курс — 205 440,00; 2 курс — 219 960,00; 3 курс — 234 036,00",
            totalCost: "659 436,00",
          },
        ],
      },
      {
        id: "tuition-2025",
        title: "Набор 2025 г.",
        description: "",
        rows: [
          {
            specialty:
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
            studyForm: "очная",
            duration: "3 года",
            yearlyCost:
              "1 курс — 198 000,00; 2 курс — 208 980,00; 3 курс — 212 772,00",
            totalCost: "619 752,00",
          },
        ],
      },
      {
        id: "tuition-2024",
        title: "Набор 2024 г.",
        description: "",
        rows: [
          {
            specialty:
              "2.3.1. Системный анализ, управление и обработка информации, статистика",
            studyForm: "очная",
            duration: "3 года",
            yearlyCost:
              "1 курс — 182 400,00; 2 курс — 192 000,00; 3 курс — 192 000,00",
            totalCost: "566 400,00",
          },
        ],
      },
    ],
  },
];

const BLOCK_SLUGS = {
  homeCards: ["block:home:program", "block:home:journal", "block:home:congratulations"],
  scienceLeft: "block:home:science-left",
  scienceRight: "block:home:science-right",
  aspirantura: "block:education:aspirantura",
  fees: "block:education:fees",
} as const;

export default function AdminVisualEditor({
  onManageNews,
}: {
  onManageNews: () => void;
}) {
  const [blocks, setBlocks] = useState<EditableBlock[]>(DEFAULT_BLOCKS);
  const [editing, setEditing] = useState<EditableBlock | null>(null);
  const [page, setPage] = useState<"home" | "education">("home");

  async function load() {
    let records: ManagedContent[] = [];
    try {
      records = (await contentRepository.list("visual_block", false)).filter((item) => item.slug.startsWith("block:"));
    } catch (reason) {
      alert(`Не удалось загрузить блоки: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
    }
    setBlocks(
      DEFAULT_BLOCKS.map((fallback) => {
        const record = records.find((item) => item.slug === fallback.slug);
        return record
          ? {
              ...fallback,
              title: record.title,
              summary: record.summary,
              body: record.body,
              tag: String(record.metadata.tag ?? fallback.tag),
              path: String(record.metadata.path ?? fallback.path),
              image_url: record.image_url,
              file_url: record.file_url,
              tableTitle: String(
                record.metadata.tableTitle ?? fallback.tableTitle ?? "",
              ),
              tableRows:
                (record.metadata.tableRows as TuitionRow[] | undefined) ??
                fallback.tableRows,
              tuitionTables:
                (record.metadata.tuitionTables as TuitionTable[] | undefined) ??
                fallback.tuitionTables,
            }
          : fallback;
      }),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await contentRepository.upsert([{
        type: "visual_block",
        slug: editing.slug,
        title: editing.title || editing.label,
        summary: sanitizeHtml(editing.summary),
        body: sanitizeHtml(editing.body),
        category: "visual-block",
        status: "published",
        published_at: new Date().toISOString(),
        image_url: editing.image_url,
        file_url: editing.file_url,
        metadata: {
          tag: editing.tag,
          path: editing.path,
          tableTitle: editing.tableTitle,
          tableRows: editing.tableRows,
          tuitionTables: editing.tuitionTables,
        },
      }]);
    } catch (reason) {
      alert(`Не удалось сохранить блок: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
      return;
    }
    setEditing(null);
    await load();
  }

  const blocksBySlug = Object.fromEntries(blocks.map((block) => [block.slug, block])) as Record<string, EditableBlock>;
  const getBlock = (slug: string) => blocksBySlug[slug] ?? DEFAULT_BLOCKS.find((block) => block.slug === slug)!;
  const cards = BLOCK_SLUGS.homeCards.map(getBlock);
  const scienceLeft = getBlock(BLOCK_SLUGS.scienceLeft);
  const scienceRight = getBlock(BLOCK_SLUGS.scienceRight);
  const aspirantura = getBlock(BLOCK_SLUGS.aspirantura);
  const fees = getBlock(BLOCK_SLUGS.fees);

  async function uploadDocument(file: File) {
    if (!editing) return;
    try {
      setEditing({ ...editing, file_url: await fileStorage.upload("education", file) });
    } catch (reason) {
      alert(`Не удалось загрузить файл: ${reason instanceof Error ? reason.message : "неизвестная ошибка"}`);
      return;
    }
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-primary">Визуальный редактор</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <MousePointer2 size={14} /> Нажмите на выделенный блок, чтобы изменить
          его содержимое.
        </p>
        <div className="inline-flex mt-4 border border-border rounded p-1 bg-card">
          <button
            onClick={() => setPage("home")}
            className={`px-4 py-2 rounded text-sm ${page === "home" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            Главная
          </button>
          <button
            onClick={() => setPage("education")}
            className={`px-4 py-2 rounded text-sm ${page === "education" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            Образование
          </button>
        </div>
      </div>
      <div className="rounded border border-border bg-[#eef2f7] p-3 sm:p-5 shadow-inner">
        <div className="mx-auto max-w-[980px] overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
          <div className="h-12 border-b border-slate-200 px-4 flex items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10" />
            <div className="ml-3">
              <div className="w-52 h-2 bg-slate-300 rounded mb-1.5" />
              <div className="w-32 h-1.5 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-8 bg-primary" />
          {page === "home" ? (
            <div className="p-4 bg-slate-50">
              <div className="grid lg:grid-cols-[1fr_250px] gap-3">
                <button
                  onClick={onManageNews}
                  className="group relative min-h-52 border-2 border-dashed border-accent/60 bg-white p-5 text-left hover:border-accent hover:bg-blue-50/30 transition-colors"
                >
                  <EditBadge />
                  <span className="text-[10px] font-bold text-green-700">
                    НОВОСТЬ
                  </span>
                  <div className="mt-4 w-4/5 h-3 bg-slate-300 rounded" />
                  <div className="mt-2 w-3/5 h-3 bg-slate-200 rounded" />
                  <p className="mt-7 text-xs text-muted-foreground">
                    Нажмите, чтобы выбрать новости для главного слайдера
                  </p>
                </button>
                <div className="grid gap-2">
                  {cards.map((block, index) => {
                    const Icon =
                      index === 0
                        ? Calendar
                        : index === 1
                          ? BookOpen
                          : Newspaper;
                    return (
                      <button
                        key={block.slug}
                        onClick={() => setEditing(block)}
                        className="group relative flex gap-3 border-2 border-dashed border-accent/60 bg-white p-3 text-left hover:border-accent hover:bg-blue-50/30 transition-colors"
                      >
                        <EditBadge />
                        <span className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                          <Icon size={15} className="text-primary" />
                        </span>
                        <span>
                          <b className="block text-[9px] text-accent">
                            {block.tag}
                          </b>
                          <span className="block text-[11px] leading-snug mt-1 line-clamp-2">
                            {block.title}
                          </span>
                        </span>
                        <ChevronRight
                          size={12}
                          className="ml-auto self-center"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 mt-3 bg-[#141830] text-white">
                <button
                  onClick={() => setEditing(scienceLeft)}
                  className="group relative min-h-36 p-5 text-left border-2 border-dashed border-white/30 hover:border-white/80"
                >
                  <EditBadge light />
                  <b className="text-xs">{scienceLeft.tag}</b>
                  <p className="text-xs text-slate-300 mt-4">
                    {scienceLeft.summary}
                  </p>
                </button>
                <button
                  onClick={() => setEditing(scienceRight)}
                  className="group relative min-h-36 p-5 text-left border-2 border-dashed border-white/30 bg-[#0f1225] hover:border-white/80"
                >
                  <EditBadge light />
                  <b className="text-xs">{scienceRight.tag}</b>
                  <p className="text-xs text-slate-300 mt-4">
                    {scienceRight.summary}
                  </p>
                </button>
              </div>
              <div className="mt-3">
                <div className="h-3 w-32 bg-slate-300 rounded mb-3" />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-16 border border-slate-200 bg-white"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50">
              <div className="grid lg:grid-cols-[230px_1fr] gap-3">
                <div className="bg-white border border-slate-200 p-3">
                  <b className="text-xs text-primary">АСПИРАНТУРА</b>
                  {[
                    "Аспирантура",
                    "Лицензия",
                    "Правила приёма",
                    "Контрольные цифры",
                    "Вступительные испытания",
                    "Стоимость обучения",
                  ].map((label) => (
                    <div
                      key={label}
                      className="mt-2 text-[10px] px-2 py-1.5 bg-slate-50 border border-slate-100"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => setEditing(aspirantura)}
                    className="group relative w-full min-h-44 text-left border-2 border-dashed border-accent/60 bg-white p-5 hover:border-accent hover:bg-blue-50/30"
                  >
                    <EditBadge />
                    <b className="text-xs text-accent">{aspirantura.tag}</b>
                    <h3 className="font-bold text-primary mt-3">
                      {aspirantura.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-3">
                      {aspirantura.summary}
                    </p>
                  </button>
                  <button
                    onClick={() => setEditing(fees)}
                    className="group relative w-full min-h-44 text-left border-2 border-dashed border-accent/60 bg-white p-5 hover:border-accent hover:bg-blue-50/30"
                  >
                    <EditBadge />
                    <b className="text-xs text-accent">{fees.tag}</b>
                    <h3 className="font-bold text-primary mt-3">
                      {fees.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-3">
                      {fees.summary}
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <form
            onSubmit={save}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-card rounded border border-border shadow-xl p-5"
          >
            <div className="flex justify-between items-center mb-5">
              <div>
                <p className="text-xs text-accent font-bold uppercase">
                  Редактирование блока
                </p>
                <h2 className="text-lg font-bold text-primary mt-1">
                  {editing.label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                title="Закрыть"
                className="p-2"
              >
                <X size={18} />
              </button>
            </div>
            {editing.slug === "block:education:fees" ? (
              <TuitionTableEditor block={editing} onChange={setEditing} />
            ) : (
              <>
                <BlockField label="Надпись над заголовком">
                  <input
                    value={editing.tag}
                    onChange={(e) =>
                      setEditing({ ...editing, tag: e.target.value })
                    }
                    className="admin-input"
                  />
                </BlockField>
                <BlockField label="Заголовок">
                  <textarea
                    rows={3}
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                    className="admin-input"
                  />
                </BlockField>
                <BlockField label="Краткое описание">
                  <textarea
                    rows={4}
                    value={editing.summary}
                    onChange={(e) =>
                      setEditing({ ...editing, summary: e.target.value })
                    }
                    className="admin-input"
                  />
                </BlockField>
                <BlockField label="Основной текст">
                  <textarea
                    rows={9}
                    value={editing.body}
                    onChange={(e) =>
                      setEditing({ ...editing, body: e.target.value })
                    }
                    className="admin-input"
                  />
                </BlockField>
              </>
            )}
            <BlockField label="Ссылка при нажатии">
              <input
                value={editing.path}
                onChange={(e) =>
                  setEditing({ ...editing, path: e.target.value })
                }
                placeholder="/раздел или https://..."
                className="admin-input"
              />
            </BlockField>
            <BlockField label="Документ">
              <div className="flex gap-2">
                <input
                  value={editing.file_url}
                  onChange={(e) =>
                    setEditing({ ...editing, file_url: e.target.value })
                  }
                  placeholder="Ссылка на файл"
                  className="admin-input"
                />
                <label className="shrink-0 px-3 flex items-center border border-slate-400 rounded cursor-pointer text-sm">
                  Загрузить
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) =>
                      e.target.files?.[0] && uploadDocument(e.target.files[0])
                    }
                  />
                </label>
              </div>
            </BlockField>
            <BlockField label="Ссылка на изображение">
              <input
                value={editing.image_url}
                onChange={(e) =>
                  setEditing({ ...editing, image_url: e.target.value })
                }
                className="admin-input"
              />
            </BlockField>
            <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded text-sm">
              <Save size={16} /> Сохранить изменения
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function TuitionTableEditor({
  block,
  onChange,
}: {
  block: EditableBlock;
  onChange: (block: EditableBlock) => void;
}) {
  const tables = block.tuitionTables ?? [];
  const updateTable = (id: string, changes: Partial<TuitionTable>) =>
    onChange({
      ...block,
      tuitionTables: tables.map((table) =>
        table.id === id ? { ...table, ...changes } : table,
      ),
    });
  const addTable = () =>
    onChange({
      ...block,
      tuitionTables: [
        ...tables,
        {
          id: `tuition-${Date.now()}`,
          title: "Новая таблица стоимости",
          description: "",
          rows: [
            {
              specialty: "",
              studyForm: "очная",
              duration: "3 года",
              yearlyCost: "",
              totalCost: "",
            },
          ],
        },
      ],
    });
  const removeTable = (id: string) =>
    onChange({
      ...block,
      tuitionTables: tables.filter((table) => table.id !== id),
    });
  const addRow = (table: TuitionTable) =>
    updateTable(table.id, {
      rows: [
        ...table.rows,
        {
          specialty: "",
          studyForm: "очная",
          duration: "3 года",
          yearlyCost: "",
          totalCost: "",
        },
      ],
    });
  const updateRow = (
    table: TuitionTable,
    index: number,
    key: keyof TuitionRow,
    value: string,
  ) =>
    updateTable(table.id, {
      rows: table.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    });
  const removeRow = (table: TuitionTable, index: number) =>
    updateTable(table.id, {
      rows: table.rows.filter((_, rowIndex) => rowIndex !== index),
    });

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">
          Таблицы стоимости
        </span>
        <button
          type="button"
          onClick={addTable}
          className="inline-flex items-center gap-1.5 text-xs bg-accent text-accent-foreground px-3 py-2 rounded"
        >
          <Plus size={14} /> Добавить таблицу
        </button>
      </div>
      <div className="space-y-5">
        {tables.map((table) => (
          <section
            key={table.id}
            className="border border-slate-400 rounded bg-secondary/20 p-4"
          >
            <div className="flex justify-between gap-3 mb-3">
              <b className="text-sm text-primary">Отдельная таблица</b>
              <button
                type="button"
                onClick={() => removeTable(table.id)}
                className="inline-flex items-center gap-1 text-xs text-red-600"
              >
                <Trash2 size={14} /> Удалить таблицу
              </button>
            </div>
            <BlockField label="Заголовок">
              <textarea
                rows={2}
                value={table.title}
                onChange={(e) =>
                  updateTable(table.id, { title: e.target.value })
                }
                className="admin-input"
              />
            </BlockField>
            <BlockField label="Описание">
              <textarea
                rows={4}
                value={table.description}
                onChange={(e) =>
                  updateTable(table.id, { description: e.target.value })
                }
                className="admin-input"
              />
            </BlockField>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Строки таблицы
              </span>
              <button
                type="button"
                onClick={() => addRow(table)}
                className="inline-flex items-center gap-1 text-xs border border-accent text-accent px-2 py-1.5 rounded"
              >
                <Plus size={13} /> Добавить строку
              </button>
            </div>
            <div className="space-y-3">
              {table.rows.map((row, index) => (
                <div
                  key={index}
                  className="relative border border-slate-300 rounded bg-card p-3 pr-11"
                >
                  <button
                    type="button"
                    onClick={() => removeRow(table, index)}
                    title="Удалить строку"
                    className="absolute right-2 top-2 p-2 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <TableInput
                      label="Научная специальность"
                      value={row.specialty}
                      onChange={(value) =>
                        updateRow(table, index, "specialty", value)
                      }
                      wide
                    />
                    <TableInput
                      label="Форма обучения"
                      value={row.studyForm}
                      onChange={(value) =>
                        updateRow(table, index, "studyForm", value)
                      }
                    />
                    <TableInput
                      label="Нормативный срок"
                      value={row.duration}
                      onChange={(value) =>
                        updateRow(table, index, "duration", value)
                      }
                    />
                    <TableInput
                      label="Стоимость в год, руб."
                      value={row.yearlyCost}
                      onChange={(value) =>
                        updateRow(table, index, "yearlyCost", value)
                      }
                      wide
                    />
                    <TableInput
                      label="Полная стоимость, руб."
                      value={row.totalCost}
                      onChange={(value) =>
                        updateRow(table, index, "totalCost", value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {tables.length === 0 && (
          <p className="text-sm text-muted-foreground border border-dashed border-slate-300 rounded p-5 text-center">
            Добавьте первую таблицу стоимости.
          </p>
        )}
      </div>
    </div>
  );
}

function TableInput({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">
        {label}
      </span>
      <textarea
        rows={wide ? 2 : 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input"
      />
    </label>
  );
}

function EditBadge({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1.5 ${light ? "bg-white text-primary" : "bg-accent text-white"}`}
    >
      <Pencil size={13} />
    </span>
  );
}
function BlockField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="block min-w-0 border-0 p-0 m-0 mb-4">
      <legend className="block w-full text-xs font-semibold text-foreground mb-1.5">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}
