import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { FileText, Download, Search } from "lucide-react";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import { DOCUMENTS, DOC_CATEGORY_LABELS, type DocumentCategory, type DocItem } from "../data";
import { useManagedContent } from "../lib/content";
import { documentCategoryFromPath } from "../data/documentCategories";

const ALL_CATS: { value: DocumentCategory | "all"; label: string }[] = [
  { value: "all", label: "Все документы" },
  { value: "charter", label: "Учредительные" },
  { value: "normative", label: "Нормативные" },
  { value: "report", label: "Отчёты" },
  { value: "anticorruption", label: "Антикоррупция" },
  { value: "privacy", label: "Обработка данных" },
];

const EXT_COLORS: Record<string, string> = {
  PDF: "bg-red-100 text-red-700",
  DOCX: "bg-blue-100 text-blue-700",
  XLSX: "bg-green-100 text-green-700",
};

export default function DocumentListPage() {
  const { pathname } = useLocation();
  const { items: managedDocuments, error } = useManagedContent("document");
  const [category, setCategory] = useState<DocumentCategory | "all">(() => documentCategoryFromPath(pathname));
  const [query, setQuery] = useState("");

  useEffect(() => setCategory(documentCategoryFromPath(pathname)), [pathname]);

  const documents = !error && managedDocuments.length > 0 ? managedDocuments.map((item) => ({
    id: item.id, title: item.title, date: item.published_at,
    category: (item.category || "normative") as DocumentCategory,
    size: String(item.metadata.size ?? "Файл"),
    ext: String(item.metadata.ext ?? item.file_url.split(".").pop() ?? "PDF").toUpperCase(),
    url: item.file_url,
  })) : DOCUMENTS.map((item) => ({ ...item, url: "" }));
  const filtered = documents.filter((d) => {
    if (category !== "all" && d.category !== category) return false;
    if (query && !d.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <Breadcrumbs crumbs={[{ label: "Документы" }]} />
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-primary mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Документы
        </h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filter */}
          <aside className="lg:w-52 shrink-0">
            <div className="bg-card border border-border rounded p-4 sticky top-24">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Разделы</h2>
              <ul className="flex flex-col gap-1">
                {ALL_CATS.map((c) => (
                  <li key={c.value}>
                    <button
                      onClick={() => setCategory(c.value)}
                      className={`w-full text-left px-3 py-2 text-sm rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        category === c.value
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center border border-border rounded bg-card px-3 py-1.5 gap-2 focus-within:border-accent transition-colors mb-5 max-w-md">
              <Search size={14} className="text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                placeholder="Поиск документов..."
                aria-label="Поиск документов"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Документов не найдено.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {category === "all" ? (
                  // Group by category
                  (Object.keys(DOC_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => {
                    const items = filtered.filter((d) => d.category === cat);
                    if (items.length === 0) return null;
                    return (
                      <section key={cat} className="mb-6" aria-labelledby={`cat-${cat}`}>
                        <h2 id={`cat-${cat}`} className="text-xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-3">
                          {DOC_CATEGORY_LABELS[cat]}
                        </h2>
                        <div className="flex flex-col gap-2">
                          {items.map((doc) => <DocRow key={doc.id} doc={doc} />)}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  filtered.map((doc) => <DocRow key={doc.id} doc={doc} />)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type DisplayDocument = Omit<DocItem, "ext"> & { ext: string; url?: string };

function DocRow({ doc }: { doc: DisplayDocument }) {
  const d = new Date(doc.date);
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded px-4 py-3 hover:border-accent transition-colors group">
      <div className="w-9 h-9 shrink-0 rounded bg-secondary flex items-center justify-center">
        <FileText size={16} className="text-primary opacity-60" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground group-hover:text-accent transition-colors leading-snug truncate">
          {doc.title}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} · {doc.size}
        </p>
      </div>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${EXT_COLORS[doc.ext] || "bg-gray-100 text-gray-600"}`}>
        {doc.ext}
      </span>
      <a
        href={doc.url || "#"}
        aria-label={`Скачать ${doc.title}`}
        className="w-8 h-8 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-secondary transition-colors"
        download
      >
        <Download size={15} aria-hidden="true" />
      </a>
    </div>
  );
}
