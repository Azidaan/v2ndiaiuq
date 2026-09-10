import { describe, expect, it } from "vitest";
import { formatFileSize } from "../pages/AdminPage";

describe("размер файла в привычном виде", () => {
  it("байты округляет до целых", () => {
    expect(formatFileSize(340)).toBe("340 Б");
  });

  it("килобайты с десятой долей", () => {
    expect(formatFileSize(1024 * 340)).toBe("340 КБ");
    expect(formatFileSize(1536)).toBe("1,5 КБ");
  });

  it("мегабайты с запятой как разделителем", () => {
    expect(formatFileSize(Math.round(1024 * 1024 * 2.4))).toBe("2,4 МБ");
  });

  it("гигабайты не переполняются", () => {
    expect(formatFileSize(1024 ** 3 * 3)).toBe("3 ГБ");
  });

  it("пустая строка на некорректных значениях", () => {
    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(-5)).toBe("");
    expect(formatFileSize(Number.NaN)).toBe("");
  });
});
