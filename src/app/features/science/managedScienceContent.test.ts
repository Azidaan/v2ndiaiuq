import { describe, expect, it } from "vitest";
import type { ManagedContent } from "../../lib/content";
import { toManagedCertificates, toManagedDepartments, toManagedResearch } from "./managedScienceContent";

function content(overrides: Partial<ManagedContent>): ManagedContent {
  return {
    id: "1",
    type: "research",
    title: "Материал",
    slug: "material",
    summary: "Описание",
    body: "<p>Текст</p>",
    category: "",
    published_at: "2026-01-01",
    status: "published",
    image_url: "",
    file_url: "",
    metadata: {},
    ...overrides,
  };
}

describe("managed science content adapters", () => {
  it("maps research records without coupling the page to database fields", () => {
    expect(toManagedResearch([content({ metadata: { navTitle: "Коротко" } })])[0]).toMatchObject({
      id: "material",
      navTitle: "Коротко",
      htmlBody: "<p>Текст</p>",
    });
  });

  it("maps certificate metadata", () => {
    const item = content({
      type: "certificate",
      category: "2026",
      slug: "certificate-42",
      file_url: "/uploads/42.pdf",
      metadata: { number: "42", authors: "Автор" },
    });
    expect(toManagedCertificates([item])[0]).toMatchObject({ year: "2026", number: "42", authors: "Автор", url: "/uploads/42.pdf" });
  });

  it("normalizes department list fields", () => {
    const item = content({
      type: "department",
      category: "ИИ",
      metadata: { areas: ["Зрение", "Речь"], projects: "Проект 1\nПроект 2" },
    });
    expect(toManagedDepartments([item])[0]).toMatchObject({ shortName: "ИИ", areas: ["Зрение", "Речь"], projects: ["Проект 1", "Проект 2"] });
  });
});
