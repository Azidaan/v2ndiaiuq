import { useState } from "react";
import { Briefcase, Calendar, Building, ChevronDown, ChevronUp } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { VACANCIES } from "../data";
import { useManagedContent } from "../lib/content";

const TYPE_LABELS = { full: "Полная занятость", part: "Частичная", contest: "Конкурс" };

function htmlToLines(value: string) {
  const withLines = value.replace(/<\/(p|div|li)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  const plain = withLines.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return plain.split("\n").map((line) => line.trim()).filter(Boolean);
}

export default function VacancyListPage() {
  const { items: managedVacancies, error } = useManagedContent("vacancy");
  const [openId, setOpenId] = useState<string | null>(null);
  const vacancies = !error && managedVacancies.length > 0 ? managedVacancies.map((item) => ({
    id: item.id, title: item.title,
    department: String(item.metadata.department ?? item.category ?? "ФГБНУ «ИПИИ»"),
    salary: String(item.metadata.salary ?? "По результатам собеседования"),
    deadline: String(item.metadata.deadline ?? item.published_at),
    type: (item.metadata.vacancyType ?? "contest") as "full" | "part" | "contest",
    requirements: htmlToLines(item.summary),
    duties: htmlToLines(item.body),
  })) : VACANCIES;

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Вакансии" }]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-display)" }}>
              Вакансии и конкурсы
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Открытые вакансии ФГБНУ «Институт проблем искусственного интеллекта»
            </p>
          </div>
          <a
            href="mailto:gu_ipii@mail.ru"
            className="bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors"
          >
            Отправить резюме
          </a>
        </div>

        {vacancies.length === 0 ? (
          <div className="bg-card border border-border rounded p-8 text-center">
            <Briefcase size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">В настоящее время открытых вакансий нет.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {vacancies.map((v) => {
              const isOpen = openId === v.id;
              const deadline = v.deadline
                ? new Date(v.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                : null;
              const duties = v.duties ?? [];
              return (
                <div key={v.id} className={`bg-card border rounded transition-all ${isOpen ? "border-accent shadow-sm" : "border-border"}`}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : v.id)}
                    className="w-full text-left px-5 py-4 flex items-start gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    aria-expanded={isOpen}
                  >
                    <div className="w-10 h-10 shrink-0 rounded-full bg-secondary flex items-center justify-center mt-0.5">
                      <Briefcase size={18} className="text-primary opacity-60" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[15px] font-semibold text-foreground leading-snug" style={{ fontFamily: "var(--font-display)" }}>
                        {v.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building size={11} aria-hidden="true" /> {v.department}
                        </span>
                        {deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} aria-hidden="true" /> До {deadline}
                          </span>
                        )}
                        <span className="font-medium text-foreground">{v.salary}</span>
                        <span className="bg-secondary px-2 py-0.5 rounded-full">{TYPE_LABELS[v.type]}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-muted-foreground mt-1" aria-hidden="true">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-0 border-t border-border">
                      <div className={`mt-4 grid grid-cols-1 ${duties.length > 0 ? "md:grid-cols-2" : ""} gap-6`}>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Квалификационные требования</h3>
                          <ul className="space-y-1.5">
                            {v.requirements.map((r, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" aria-hidden="true" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {duties.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Дополнительно</h3>
                            <ul className="space-y-1.5">
                              {duties.map((d, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" aria-hidden="true" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="mt-5 flex gap-3">
                        <a
                          href="mailto:gu_ipii@mail.ru"
                          className="bg-accent text-accent-foreground text-sm px-4 py-2 rounded hover:bg-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Откликнуться
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* General info */}
        <div className="mt-8 bg-secondary border border-border rounded p-5">
          <h2 className="text-sm font-bold text-primary mb-2">Как подать документы</h2>
          <p className="text-sm text-foreground leading-relaxed mb-3">
            Своевременная выплата заработной платы 2 раза в месяц. Предусмотрен социальный пакет, ежемесячные надбавки и доплаты. Предоставляется ежегодный отпуск 28 календарных дней.
          </p>
          <div className="space-y-1 text-sm text-foreground leading-relaxed">
            <p className="font-semibold text-primary">График работы:</p>
            <p>5-ти дневная рабочая неделя с двумя выходными</p>
            <p>с 8:00 до 16:48 перерыв с 12:00 до 12:48</p>
            <p>в пятницу с 8:00 до 15:48</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed mt-3">
            По вопросам трудоустройства резюме направлять на электронную почту{" "}
            <a href="mailto:gu_ipii@mail.ru" className="text-accent hover:underline">gu_ipii@mail.ru</a>{" "}
            или звонить по телефону <a href="tel:+79493371606" className="text-accent hover:underline">+7 949 337-16-06</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
