import { describe, expect, it } from "vitest";
import { documentCategoryFromPath, documentCategoryPath } from "./documentCategories";

describe("document category routes", () => {
  it("uses the registered plural route for reports", () => {
    expect(documentCategoryPath("report")).toBe("/documents/reports");
    expect(documentCategoryFromPath("/documents/reports")).toBe("report");
  });

  it("returns all for the document index", () => {
    expect(documentCategoryFromPath("/documents")).toBe("all");
  });
});
