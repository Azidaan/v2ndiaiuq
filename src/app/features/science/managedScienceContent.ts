import type { Department } from "../../data";
import type { ManagedContent } from "../../lib/content";

export interface ManagedResearchView {
  id: string;
  navTitle: string;
  title: string;
  image?: string;
  summary: string;
  htmlBody: string;
}

export interface ManagedCertificateView {
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

export type ManagedDepartmentView = Department & { htmlBody?: string };

export function toManagedResearch(items: ManagedContent[]): ManagedResearchView[] {
  return items.map((item) => ({
    id: item.slug,
    navTitle: String(item.metadata.navTitle || item.title),
    title: item.title,
    image: item.image_url || undefined,
    summary: item.summary,
    htmlBody: item.body,
  }));
}

export function toManagedCertificates(items: ManagedContent[]): ManagedCertificateView[] {
  return items.map((item) => ({
    year: item.category || item.published_at.slice(0, 4),
    number: String(item.metadata.number || item.slug.replace(/^certificate-/, "")),
    title: item.title,
    application: String(item.metadata.application || ""),
    filed: String(item.metadata.filed || ""),
    published: String(item.metadata.published || ""),
    authors: String(item.metadata.authors || ""),
    url: item.file_url || undefined,
    extra: item.summary || undefined,
  }));
}

export function toManagedDepartments(items: ManagedContent[]): ManagedDepartmentView[] {
  return items.map((item) => ({
    id: item.slug,
    name: item.title,
    shortName: item.category,
    description: item.summary,
    areas: stringList(item.metadata.areas),
    projects: stringList(item.metadata.projects),
    externalUrl: String(item.metadata.externalUrl || "") || undefined,
    image: item.image_url,
    htmlBody: item.body || undefined,
  }));
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((line) => line.trim()).filter(Boolean);
  return [];
}
