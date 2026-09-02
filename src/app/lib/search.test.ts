import { describe, expect, it } from "vitest";
import { getSearchScore, normalizeSearchText, type SearchEntry } from "./search";

const entry: SearchEntry = {
  title: "Робототехническая система",
  description: "Исследование института",
  path: "/science/research/robot",
  type: "Исследование",
  searchText: "управление роботом",
};

describe("site search", () => {
  it("normalizes case, whitespace and ё", () => {
    expect(normalizeSearchText("  Ёлка   РОБОТ  ")).toBe("елка робот");
  });

  it("requires every query term", () => {
    expect(getSearchScore(entry, ["робот", "институт"])).toBeGreaterThanOrEqual(0);
    expect(getSearchScore(entry, ["робот", "медицина"])).toBe(-1);
  });

  it("ranks a title match above a body match", () => {
    expect(getSearchScore(entry, ["робот"])).toBeGreaterThan(getSearchScore({ ...entry, title: "Система", searchText: "робот" }, ["робот"]));
  });
});
