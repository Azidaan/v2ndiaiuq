import { apiRequest } from "./apiClient";

export interface FileStorage {
  upload(folder: string, file: File): Promise<string>;
}

export const fileStorage: FileStorage = {
  async upload(folder, file) {
    const form = new FormData();
    form.append("folder", folder);
    form.append("file", file);
    const result = await apiRequest<{ url: string }>("/api/admin/uploads", { method: "POST", body: form });
    return result.url;
  },
};
