import { DOCUMENTS, NEWS, VACANCIES } from "../../data";
import { PUBLICATION_ARCHIVE_SECTIONS } from "../../data/publicationsArchive";
import { DEPARTMENTS } from "../../data";
import { RESEARCH_ITEMS } from "../../pages/ScienceResearchPage";
import { CERTIFICATES } from "../../pages/ScienceCertificatesPage";
import type { ContentType } from "../../lib/content";

export const ADMIN_CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "news", label: "Новости" },
  { value: "publication", label: "Публикации" },
  { value: "vacancy", label: "Вакансии и конкурсы" },
  { value: "document", label: "Документы" },
  { value: "research", label: "Исследования и разработки" },
  { value: "certificate", label: "Свидетельства для ЭВМ" },
  { value: "department", label: "Научные отделы" },
];

export function getSeedRows(type: ContentType) {
  if (type === "news") return NEWS.map((item) => ({
    type, title: item.title, slug: item.id, summary: item.excerpt, body: item.body,
    category: item.category, published_at: item.date, status: "published", image_url: item.image ?? "", file_url: "",
    metadata: { tags: item.tags ?? [] },
  }));
  if (type === "vacancy") return VACANCIES.map((item) => ({
    type, title: item.title, slug: `vacancy-${item.id}`, summary: item.requirements.join("\n"), body: (item.duties ?? []).join("\n"),
    category: "", published_at: item.deadline || new Date().toISOString(), status: "published", image_url: "", file_url: "",
    metadata: { department: item.department, salary: item.salary, deadline: item.deadline, vacancyType: item.type },
  }));
  if (type === "document") return DOCUMENTS.map((item) => ({
    type, title: item.title, slug: `document-${item.id}`, summary: "", body: "", category: item.category,
    published_at: item.date, status: "published", image_url: "", file_url: "", metadata: { size: item.size, ext: item.ext },
  }));
  if (type === "publication") return PUBLICATION_ARCHIVE_SECTIONS.map((item) => ({
    type, title: `Публикации сотрудников за ${item.year} год`, slug: `publications-${item.year}`, summary: "", body: item.content,
    category: "archive", published_at: `${item.year}-01-01`, status: "published", image_url: "", file_url: "", metadata: {},
  }));
  if (type === "research") return RESEARCH_ITEMS.map((item) => ({
    type, title: item.title, slug: item.id, summary: item.paragraphs?.[0] ?? "",
    body: [
      ...(item.paragraphs ?? []).map((paragraph) => `<p>${paragraph}</p>`),
      ...(item.sections ?? []).map((section) => `<h2>${section.title}</h2><ul>${section.items.map((entry) => `<li>${entry}</li>`).join("")}</ul>`),
      ...(item.quote ? [`<blockquote>${item.quote}</blockquote>`] : []),
    ].join(""),
    category: "", published_at: new Date().toISOString(), status: "published",
    image_url: item.image ?? "", file_url: "", metadata: { navTitle: item.navTitle },
  }));
  if (type === "certificate") return CERTIFICATES.map((item) => ({
    type, title: item.title, slug: `certificate-${item.number}`, summary: item.extra ?? "", body: "",
    category: item.year, published_at: toIsoDate(item.published), status: "published",
    image_url: "", file_url: item.url ?? "",
    metadata: { number: item.number, application: item.application, filed: item.filed, published: item.published, authors: item.authors },
  }));
  if (type === "department") return DEPARTMENTS.map((item) => ({
    type, title: item.name, slug: item.id, summary: item.description,
    body: (item.extra ?? []).map((paragraph) => `<p>${paragraph}</p>`).join(""),
    category: item.shortName, published_at: new Date().toISOString(), status: "published",
    image_url: item.image, file_url: "",
    metadata: { areas: item.areas, projects: item.projects ?? [], externalUrl: item.externalUrl ?? "" },
  }));
  return [];
}

function toIsoDate(value: string) {
  const [day, month, year] = value.split(".");
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

export type ScienceMetadataField = {
  key: "navTitle" | "number" | "application" | "filed" | "published" | "authors" | "areas" | "projects" | "externalUrl";
  label: string;
  kind?: "text" | "textarea";
  placeholder?: string;
  lines?: boolean;
};

export const SCIENCE_METADATA_FIELDS: Partial<Record<ContentType, ScienceMetadataField[]>> = {
  research: [{ key: "navTitle", label: "Короткое название для списка", placeholder: "Отображается в карточке и боковом меню" }],
  certificate: [
    { key: "number", label: "Номер свидетельства" },
    { key: "application", label: "Номер заявки" },
    { key: "filed", label: "Дата подачи", placeholder: "ДД.ММ.ГГГГ" },
    { key: "published", label: "Дата публикации", placeholder: "ДД.ММ.ГГГГ" },
    { key: "authors", label: "Авторы", kind: "textarea" },
  ],
  department: [
    { key: "areas", label: "Проблематика исследований", kind: "textarea", lines: true, placeholder: "Один пункт на строку" },
    { key: "projects", label: "Проекты и работы", kind: "textarea", lines: true, placeholder: "Один проект на строку" },
    { key: "externalUrl", label: "Ссылка на сайт подразделения", placeholder: "https://..." },
  ],
};

export const CATEGORY_LABELS: Partial<Record<ContentType, string>> = {
  certificate: "Год",
  department: "Сокращённое название",
};
