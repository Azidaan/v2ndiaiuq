import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

/** Период фильтрации. Глубину выбирает пользователь: год, год с месяцем или точный день. */
export type DatePeriod = { year: number; month?: number; day?: number } | null;

const MONTHS_NOMINATIVE = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type View = "day" | "month" | "year";

const pad = (value: number) => String(value).padStart(2, "0");

/** Подпись на кнопке: чем глубже выбор, тем подробнее. */
export function formatPeriod(period: DatePeriod): string {
  if (!period) return "Все годы";
  if (period.day && period.month) return `${period.day} ${MONTHS_GENITIVE[period.month - 1]} ${period.year}`;
  if (period.month) return `${MONTHS_NOMINATIVE[period.month - 1].toLowerCase()} ${period.year}`;
  return String(period.year);
}

/** Сопоставление ISO-даты материала с периодом через сравнение префикса. */
export function matchesPeriod(isoDate: string, period: DatePeriod): boolean {
  if (!period) return true;
  if (period.day && period.month) return isoDate.startsWith(`${period.year}-${pad(period.month)}-${pad(period.day)}`);
  if (period.month) return isoDate.startsWith(`${period.year}-${pad(period.month)}`);
  return isoDate.startsWith(String(period.year));
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Номер дня недели, считая с понедельника: 0 — понедельник, 6 — воскресенье. */
const mondayIndex = (year: number, month: number, day: number) => (new Date(year, month - 1, day).getDay() + 6) % 7;

export default function DatePeriodPicker({
  value,
  onChange,
  dates,
  className = "",
}: {
  value: DatePeriod;
  onChange: (value: DatePeriod) => void;
  /** ISO-даты имеющихся материалов: периоды без материалов гасятся. */
  dates: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("year");
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: value?.year ?? today.getFullYear(),
    month: value?.month ?? today.getMonth() + 1,
    day: value?.day ?? today.getDate(),
  }));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  // Какие годы, месяцы и дни вообще представлены в материалах.
  const available = useMemo(() => {
    const years = new Set<number>();
    const months = new Set<string>();
    const days = new Set<string>();
    for (const iso of dates) {
      const [year, month, day] = iso.slice(0, 10).split("-");
      if (!year || !month || !day) continue;
      years.add(Number(year));
      months.add(`${year}-${month}`);
      days.add(`${year}-${month}-${day}`);
    }
    return { years: [...years].sort((a, b) => b - a), months, days };
  }, [dates]);

  const hasMonth = (year: number, month: number) => available.months.has(`${year}-${pad(month)}`);
  const hasDay = (year: number, month: number, day: number) => available.days.has(`${year}-${pad(month)}-${pad(day)}`);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Панель шире кнопки. У правого края экрана прижимаем её вправо, иначе она
  // вылезет за пределы страницы и вернёт горизонтальную прокрутку.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;
      setAlignRight(root.getBoundingClientRect().left + panel.offsetWidth > window.innerWidth - 8);
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, view]);

  function pickYear(year: number) {
    setCursor((current) => ({ ...current, year }));
    onChange({ year });
    setView("month");
  }
  function pickMonth(month: number) {
    setCursor((current) => ({ ...current, month }));
    onChange({ year: cursor.year, month });
    setView("day");
  }
  function pickDay(day: number) {
    setCursor((current) => ({ ...current, day }));
    onChange({ year: cursor.year, month: cursor.month, day });
    setOpen(false);
  }
  function reset() {
    onChange(null);
    setOpen(false);
  }
  function shiftMonth(delta: number) {
    setCursor((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { ...current, year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  }

  const segmentClass = (active: boolean) =>
    `rounded px-2 py-1 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-primary underline decoration-dotted underline-offset-4 hover:bg-secondary"
    }`;
  const cellClass = (selected: boolean, enabled: boolean) =>
    selected
      ? "bg-primary font-semibold text-primary-foreground"
      : enabled
        ? "text-foreground hover:bg-secondary"
        : "cursor-not-allowed text-muted-foreground/35";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (open) { setOpen(false); return; }
          setView(value?.month ? "day" : value ? "month" : "year");
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Фильтр по дате: ${formatPeriod(value)}`}
        className="flex w-full items-center gap-2 rounded border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
      >
        <CalendarDays size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-left">{formatPeriod(value)}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Сбросить фильтр по дате"
            onClick={(event) => { event.stopPropagation(); reset(); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                reset();
              }
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X size={13} aria-hidden="true" />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Выбор периода"
          className={`absolute top-full z-30 mt-2 w-[290px] max-w-[calc(100vw-2rem)] rounded border border-border bg-card p-3 shadow-lg ${alignRight ? "right-0" : "left-0"}`}
        >
          {/* Сегменты даты. Активный залит, остальные подчёркнуты пунктиром — видно, что кликабельны. */}
          <div className="flex items-center justify-center gap-1 border-b border-border pb-3">
            <button type="button" onClick={() => setView("day")} aria-pressed={view === "day"} className={segmentClass(view === "day")}>
              {value?.day ?? cursor.day}
            </button>
            <button type="button" onClick={() => setView("month")} aria-pressed={view === "month"} className={segmentClass(view === "month")}>
              {MONTHS_NOMINATIVE[(value?.month ?? cursor.month) - 1].toLowerCase()}
            </button>
            <button type="button" onClick={() => setView("year")} aria-pressed={view === "year"} className={segmentClass(view === "year")}>
              {value?.year ?? cursor.year}
            </button>
          </div>

          {view === "day" && (
            <div className="pt-3">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <span className="text-sm font-semibold text-primary">
                  {MONTHS_NOMINATIVE[cursor.month - 1]} {cursor.year}
                </span>
                <button type="button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
                {WEEKDAYS.map((weekday) => <span key={weekday} className="py-1">{weekday}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: mondayIndex(cursor.year, cursor.month, 1) }).map((_, index) => (
                  <span key={`pad-${index}`} />
                ))}
                {Array.from({ length: daysInMonth(cursor.year, cursor.month) }, (_, index) => index + 1).map((day) => {
                  const enabled = hasDay(cursor.year, cursor.month, day);
                  const selected = value?.day === day && value?.month === cursor.month && value?.year === cursor.year;
                  const isToday =
                    day === today.getDate() &&
                    cursor.month === today.getMonth() + 1 &&
                    cursor.year === today.getFullYear();
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!enabled}
                      onClick={() => pickDay(day)}
                      aria-label={`${day} ${MONTHS_GENITIVE[cursor.month - 1]} ${cursor.year}${enabled ? "" : ", материалов нет"}`}
                      aria-current={selected ? "date" : undefined}
                      className={`h-8 rounded text-xs transition-colors ${cellClass(selected, enabled)} ${
                        isToday && !selected ? "ring-1 ring-accent" : ""
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === "month" && (
            <div className="grid grid-cols-3 gap-1 pt-3">
              {MONTHS_SHORT.map((label, index) => {
                const month = index + 1;
                const enabled = hasMonth(cursor.year, month);
                const selected = value?.month === month && value?.year === cursor.year;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!enabled}
                    onClick={() => pickMonth(month)}
                    aria-label={`${MONTHS_NOMINATIVE[index]} ${cursor.year}${enabled ? "" : ", материалов нет"}`}
                    className={`rounded py-2 text-xs transition-colors ${cellClass(selected, enabled)}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {view === "year" && (
            <div className="grid grid-cols-3 gap-1 pt-3">
              {available.years.length === 0 && (
                <p className="col-span-3 py-4 text-center text-xs text-muted-foreground">Материалов нет</p>
              )}
              {available.years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => pickYear(year)}
                  aria-label={`${year} год`}
                  className={`rounded py-2 text-xs transition-colors ${cellClass(value?.year === year, true)}`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <button type="button" onClick={reset} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
              Все годы
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-accent">
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
