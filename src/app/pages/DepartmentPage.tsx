import { Link, useParams } from "react-router";
import { ChevronRight, ExternalLink } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import SafeHtml from "../components/SafeHtml";
import { DEPARTMENTS } from "../data";
import { useManagedContent } from "../lib/content";
import { toManagedDepartments, type ManagedDepartmentView } from "../features/science/managedScienceContent";
import SafeImage from "../components/ui/SafeImage";

function DepartmentCard({ dep }: { dep: ManagedDepartmentView }) {
  return (
    <Link
      to={`/institute/departments/${dep.id}`}
      className="bg-card rounded border border-border hover:border-accent hover:shadow-sm group transition-all overflow-hidden flex flex-col"
    >
      <div className="h-40 bg-secondary overflow-hidden">
        <SafeImage src={dep.image} alt={dep.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{dep.shortName}</span>
        <h2 className="text-[14px] font-semibold text-foreground mt-1 mb-2 leading-snug group-hover:text-accent transition-colors" style={{ fontFamily: "var(--font-display)" }}>
          {dep.name}
        </h2>
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3 flex-1">{dep.description}</p>
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-border">
          <span className="text-[11px] text-accent flex items-center gap-1">
            Подробнее <ChevronRight size={11} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function SingleDepartment({ id, departments }: { id: string; departments: ManagedDepartmentView[] }) {
  const dep = departments.find((d) => d.id === id);
  if (!dep) return (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">Подразделение не найдено.</p>
      <Link to="/institute/departments" className="text-accent hover:underline text-sm mt-2 inline-block">← Назад к списку</Link>
    </div>
  );

  return (
    <>
      <Breadcrumbs crumbs={[
        { label: "Институт", path: "/institute" },
        { label: "Научные отделы", path: "/institute/departments" },
        { label: dep.shortName },
      ]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-accent uppercase tracking-widest">{dep.shortName}</span>
            <h1 className="text-2xl font-bold text-foreground mt-1 mb-4" style={{ fontFamily: "var(--font-display)" }}>
              {dep.name}
            </h1>
            <div className="mb-6 rounded overflow-hidden bg-secondary h-[280px] max-w-lg">
              <SafeImage src={dep.image} alt={dep.name} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-6">{dep.description}</p>
            {dep.extra?.map((paragraph) => (
              <p key={paragraph} className="text-sm text-foreground leading-relaxed mb-4">{paragraph}</p>
            ))}
            {dep.htmlBody && <SafeHtml html={dep.htmlBody} className="prose prose-sm max-w-none text-foreground mb-6" />}

            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">Проблематика исследований</h2>
            <ul className="flex flex-col gap-2 mb-6">
              {dep.areas.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>

            {dep.projects && dep.projects.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">
                  Участие в разработке и работы
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {dep.projects.map((project) => (
                    <li key={project} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                      <span>{project}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {dep.externalUrl && (
              <a
                href={dep.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
              >
                Перейти на сайт лаборатории <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>

          <aside className="w-full lg:w-[260px] shrink-0">
            <div className="bg-card border border-border rounded p-4 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Научные отделы</h2>
              <div className="space-y-2">
                {departments.map((item) => (
                  <Link
                    key={item.id}
                    to={`/institute/departments/${item.id}`}
                    className={`block text-xs leading-snug hover:text-accent ${item.id === dep.id ? "font-semibold text-accent" : "text-muted-foreground"}`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-secondary border border-border rounded p-4">
              <Link to="/institute/departments" className="text-xs text-accent hover:underline mt-3 inline-block">
                ← Все подразделения
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

export default function DepartmentPage() {
  const { id } = useParams<{ id?: string }>();
  const { items: managedItems, error } = useManagedContent("department");
  const departments: ManagedDepartmentView[] = !error && managedItems.length > 0
    ? toManagedDepartments(managedItems)
    : DEPARTMENTS;

  if (id) return <SingleDepartment id={id} departments={departments} />;

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[
        { label: "Институт", path: "/institute" },
        { label: "Научные отделы" },
      ]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Научные отделы и лаборатории
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {departments.map((dep) => (
            <DepartmentCard key={dep.id} dep={dep} />
          ))}
        </div>
      </div>
    </div>
  );
}
