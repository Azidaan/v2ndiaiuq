export interface SearchEntry {
  title: string;
  description: string;
  path: string;
  type: string;
  searchText?: string;
}

export function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

export function getSearchScore(entry: SearchEntry, terms: string[]) {
  const title = normalizeSearchText(entry.title);
  const description = normalizeSearchText(entry.description);
  const extra = normalizeSearchText(entry.searchText ?? "");
  const fullText = `${title} ${description} ${extra}`;

  if (!terms.every((term) => fullText.includes(term))) return -1;

  return terms.reduce((score, term) => {
    if (title === term) return score + 10;
    if (title.startsWith(term)) return score + 6;
    if (title.includes(term)) return score + 4;
    if (description.includes(term)) return score + 2;
    return score + 1;
  }, 0);
}
