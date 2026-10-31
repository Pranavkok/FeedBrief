const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "i", "in", "is", "it", "its", "me", "my", "of", "on", "or", "our", "she", "that",
  "the", "their", "them", "there", "this", "to", "was", "we", "were", "will", "with", "you", "your"
]);

export function searchHistory(history, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [...history];
  const terms = tokenize(normalized);
  if (!terms.length) return [...history];

  const documents = history.map((item) => ({ item, text: historyText(item), tokens: tokenize(historyText(item)) }));
  const documentFrequency = new Map();
  for (const term of terms) {
    documentFrequency.set(term, documents.filter((doc) => doc.tokens.includes(term)).length);
  }
  const scored = documents.map((doc) => {
    const length = Math.max(1, doc.tokens.length);
    let score = 0;
    for (const term of terms) {
      const count = doc.tokens.filter((token) => token === term).length;
      if (!count) continue;
      const df = documentFrequency.get(term) || 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const tf = (count * 2.2) / (count + 1.2 * (0.25 + 0.75 * length / 250));
      score += idf * tf;
    }
    if (doc.text.includes(normalized)) score += 3;
    const allTermsMatch = terms.every((term) => doc.tokens.includes(term));
    if (allTermsMatch) score += 1.5;
    return { item: doc.item, score };
  });
  return scored.filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt))
    .map((entry) => entry.item);
}

function historyText(item) {
  const sections = item?.sections || {};
  const concepts = Array.isArray(sections.concepts) ? sections.concepts.map((x) => `${x.name || ""} ${x.explanation || ""}`).join(" ") : "";
  const claims = Array.isArray(sections.claims) ? sections.claims.map((x) => `${x.claim || ""} ${x.qualification || ""}`).join(" ") : "";
  const values = (value) => Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  return [item?.summary, item?.sourceText, sections.tldr, sections.whyItMatters,
    ...values(sections.keyTakeaways), concepts, claims, ...values(sections.examples), ...values(sections.caveats), ...values(sections.actionItems)]
    .filter((value) => typeof value === "string").join(" ").toLowerCase();
}

function tokenize(value) {
  return String(value).normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter((term) => !STOP_WORDS.has(term)) || [];
}
