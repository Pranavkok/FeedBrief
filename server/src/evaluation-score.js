export function scoreEvaluation({ sections, expectedTerms = [], sourceText = "" }) {
  const serialized = JSON.stringify(sections || {}).toLowerCase();
  const normalizedSource = String(sourceText).toLowerCase();
  const terms = expectedTerms.map((term) => String(term).toLowerCase()).filter(Boolean);
  const coveredTerms = terms.filter((term) => serialized.includes(term));
  const coverage = terms.length ? coveredTerms.length / terms.length : 1;
  const requiredKeys = ["tldr", "keyTakeaways", "whyItMatters", "concepts", "claims", "examples", "caveats", "actionItems"];
  const presentKeys = requiredKeys.filter((key) => sections && Object.hasOwn(sections, key));
  const structure = presentKeys.length / requiredKeys.length;
  const sourceNumbers = new Set(normalizedSource.match(/\b\d+(?:\.\d+)?(?:%|\b)/g) || []);
  const outputNumbers = [...new Set(serialized.match(/\b\d+(?:\.\d+)?(?:%|\b)/g) || [])];
  const unsupportedNumbers = outputNumbers.filter((number) => !sourceNumbers.has(number));
  const score = Math.round((coverage * 0.75 + structure * 0.25) * 100);
  return {
    score,
    coverage: Number((coverage * 100).toFixed(1)),
    structure: Number((structure * 100).toFixed(1)),
    coveredTerms,
    missingTerms: terms.filter((term) => !coveredTerms.includes(term)),
    unsupportedNumbers,
    warnings: unsupportedNumbers.length ? ["Review numbers in the summary that do not appear in the source."] : []
  };
}
