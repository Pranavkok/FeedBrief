import test from "node:test";
import assert from "node:assert/strict";
import { scoreEvaluation } from "../src/evaluation-score.js";

test("evaluation score measures expected term coverage and structure", () => {
  const sections = {
    tldr: "PostgreSQL composite index improves lookup.", keyTakeaways: [], whyItMatters: "",
    concepts: [], claims: [], examples: [], caveats: [], actionItems: []
  };
  const result = scoreEvaluation({ sections, expectedTerms: ["postgresql", "composite index", "kafka"], sourceText: "PostgreSQL composite index" });
  assert.equal(result.coverage, 66.7);
  assert.equal(result.structure, 100);
  assert.deepEqual(result.missingTerms, ["kafka"]);
});

test("evaluation warns about numbers not present in source", () => {
  const result = scoreEvaluation({ sections: { tldr: "It improved by 99%." }, sourceText: "It improved." });
  assert.deepEqual(result.unsupportedNumbers, ["99%"]);
});
