import { apiRequest } from "./apiClient";
import type { ContentType, ManagedContent } from "./content";

export interface ContentRepository {
  list(type: ContentType, publishedOnly?: boolean): Promise<ManagedContent[]>;
  listPublished(): Promise<ManagedContent[]>;
  slugExists(slug: string): Promise<boolean>;
  save(item: ManagedContent): Promise<void>;
  upsert(items: Omit<ManagedContent, "id">[] | Record<string, unknown>[]): Promise<void>;
  remove(id: string): Promise<void>;
}

class ApiContentRepository implements ContentRepository {
  async list(type: ContentType, publishedOnly = true) {
    return apiRequest<ManagedContent[]>(`${publishedOnly ? "/api/content" : "/api/admin/content"}?type=${encodeURIComponent(type)}`);
  }

  async listPublished() {
    return apiRequest<ManagedContent[]>("/api/content");
  }

  async slugExists(slug: string) {
    const result = await apiRequest<{ exists: boolean }>(`/api/admin/content/slug-exists?slug=${encodeURIComponent(slug)}`);
    return result.exists;
  }

  async save(item: ManagedContent) {
    const { id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = item;
    await apiRequest(id ? `/api/admin/content/${encodeURIComponent(id)}` : "/api/admin/content", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
  }

  async upsert(items: Omit<ManagedContent, "id">[] | Record<string, unknown>[]) {
    await apiRequest("/api/admin/content/upsert", { method: "POST", body: JSON.stringify(items) });
  }

  async remove(id: string) {
    await apiRequest(`/api/admin/content/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export const contentRepository: ContentRepository = new ApiContentRepository();
