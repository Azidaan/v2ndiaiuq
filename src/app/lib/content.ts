import { useEffect, useState } from "react";
import { contentRepository } from "./contentRepository";

export type ContentType =
  | "news"
  | "publication"
  | "vacancy"
  | "document"
  | "visual_block"
  | "research"
  | "certificate"
  | "department";

export interface ContentMetadata {
  tags?: string[];
  featured?: boolean;
  featuredOrder?: number | string;
  department?: string;
  salary?: string;
  deadline?: string;
  vacancyType?: "full" | "part" | "contest";
  size?: string;
  ext?: string;
  tag?: string;
  path?: string;
  hidden?: boolean;
  tableTitle?: string;
  tableRows?: unknown[];
  tuitionTables?: unknown[];
  navTitle?: string;
  number?: string;
  application?: string;
  filed?: string;
  published?: string;
  authors?: string;
  areas?: string[] | string;
  projects?: string[] | string;
  externalUrl?: string;
  [key: string]: unknown;
}

export interface ManagedContent {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  published_at: string;
  status: "draft" | "published";
  image_url: string;
  file_url: string;
  metadata: ContentMetadata;
  created_at?: string;
  updated_at?: string;
}

export const EMPTY_CONTENT: ManagedContent = {
  id: "",
  type: "news",
  title: "",
  slug: "",
  summary: "",
  body: "",
  category: "",
  published_at: new Date().toISOString().slice(0, 10),
  status: "draft",
  image_url: "",
  file_url: "",
  metadata: {},
};

export function useManagedContent(type: ContentType) {
  const [items, setItems] = useState<ManagedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    contentRepository.list(type, true)
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("Не удалось загрузить материалы")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type]);

  return { items, loading, error };
}

export function useAllManagedContent() {
  const [items, setItems] = useState<ManagedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    contentRepository.listPublished()
      .then((data) => { if (active) setItems(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason : new Error("Не удалось загрузить материалы")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { items, loading, error };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}
