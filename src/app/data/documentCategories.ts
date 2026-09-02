import type { DocumentCategory } from "./index";

export const DOCUMENT_CATEGORY_CONFIG: Record<DocumentCategory, { label: string; path: string }> = {
  charter: { label: "Учредительные", path: "/documents/charter" },
  normative: { label: "Нормативные", path: "/documents/normative" },
  report: { label: "Отчёты", path: "/documents/reports" },
  anticorruption: { label: "Антикоррупция", path: "/documents/anticorruption" },
  privacy: { label: "Обработка данных", path: "/documents/privacy" },
};

export function documentCategoryPath(category: DocumentCategory) {
  return DOCUMENT_CATEGORY_CONFIG[category].path;
}

export function documentCategoryFromPath(pathname: string): DocumentCategory | "all" {
  return (Object.entries(DOCUMENT_CATEGORY_CONFIG).find(([, config]) => config.path === pathname)?.[0] as DocumentCategory | undefined) ?? "all";
}
