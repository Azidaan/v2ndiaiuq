import { describe, expect, it, vi } from "vitest";
import { InquiryService } from "./inquiryService.mjs";

function repository(overrides = {}) {
  return {
    create: vi.fn(async (input) => ({ id: "1", ...input })),
    list: vi.fn(async () => []),
    findById: vi.fn(async () => ({ id: "1" })),
    update: vi.fn(async (id, input) => ({ id, ...input })),
    remove: vi.fn(async () => true),
    ...overrides,
  };
}

describe("InquiryService", () => {
  it("normalizes and stores a valid inquiry", async () => {
    const repo = repository();
    const service = new InquiryService(repo);
    await service.create({ name: " Иван Иванов ", email: "IVAN@EXAMPLE.RU", subject: " Вопрос ", message: " Подробный текст обращения " });
    expect(repo.create).toHaveBeenCalledWith({ name: "Иван Иванов", email: "ivan@example.ru", subject: "Вопрос", message: "Подробный текст обращения" });
  });

  it("rejects invalid public input", async () => {
    const service = new InquiryService(repository());
    await expect(service.create({ name: "А", email: "wrong", message: "коротко" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("silently accepts honeypot submissions without storing them", async () => {
    const repo = repository();
    const service = new InquiryService(repo);
    await expect(service.create({ website: "spam.example" })).resolves.toEqual({ accepted: true });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("validates status updates", async () => {
    const service = new InquiryService(repository());
    await expect(service.update("1", { status: "unknown" })).rejects.toMatchObject({ statusCode: 400 });
  });
});
