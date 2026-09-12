type CatalogCategory = { id: string; name: string; parentId: string | null; };

function normalizedWords(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function categorySimilarity(left: string, right: string) {
  const leftWords = new Set(normalizedWords(left));
  const rightWords = new Set(normalizedWords(right));
  if (!leftWords.size || !rightWords.size) return 0;
  const leftText = [...leftWords].join(" ");
  const rightText = [...rightWords].join(" ");
  if (leftText === rightText) return 1;
  if (leftText.includes(rightText) || rightText.includes(leftText)) return 0.85;
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return intersection / union;
}

export function matchSuggestedCategory(categoryName: string, categories: CatalogCategory[]) {
  const candidates = categories
    .filter((category) => category.parentId !== null)
    .map((category) => ({ category, score: categorySimilarity(categoryName, category.name) }))
    .sort((left, right) => right.score - left.score);
  return candidates[0]?.score >= 0.45 ? candidates[0].category : null;
}
