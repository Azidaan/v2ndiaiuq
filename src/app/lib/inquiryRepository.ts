import { apiRequest } from "./apiClient";

export type InquiryStatus = "new" | "in_progress" | "resolved";

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
}

export interface InquiryRepository {
  list(status?: InquiryStatus): Promise<Inquiry[]>;
  update(id: string, input: Pick<Inquiry, "status" | "admin_note">): Promise<Inquiry>;
  remove(id: string): Promise<void>;
}

class ApiInquiryRepository implements InquiryRepository {
  list(status?: InquiryStatus) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest<Inquiry[]>(`/api/admin/inquiries${query}`);
  }

  update(id: string, input: Pick<Inquiry, "status" | "admin_note">) {
    return apiRequest<Inquiry>(`/api/admin/inquiries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async remove(id: string) {
    await apiRequest(`/api/admin/inquiries/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export const inquiryRepository: InquiryRepository = new ApiInquiryRepository();
