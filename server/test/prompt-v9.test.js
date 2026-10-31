import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseSummary, formatSummary, PROMPT_VERSION } from "../src/prompt.js";

test("V9 prompt includes reader context and mode", () => {
  const prompt = buildPrompt({
    length: "detailed", tone: "technical", language: "en", mode: "technical",
    profile: { expertise: "advanced", focusAreas: "distributed systems", feedbackHints: "preserve trade-offs" }
  });
  assert.match(prompt, /distributed systems/);
  assert.match(prompt, /advanced/);
  assert.match(prompt, /technical deep-dive|Prioritize architecture/i);
  assert.match(PROMPT_VERSION, /v9/);
});

test("parser sanitizes all structured extraction fields and formatting includes them", () => {
  const sections = parseSummary(JSON.stringify({
    tldr: "A system design post.", keyTakeaways: ["Use partitioning."], whyItMatters: "It changes scaling.",
    concepts: [{ name: "Partitioning", explanation: "Splits data." }],
    claims: [{ claim: "Reads scale out.", qualification: "Within shard limits." }],
    examples: ["User IDs."], caveats: ["Adds operational cost."], actionItems: ["Measure hot keys."]
  }));
  const formatted = formatSummary(sections);
  assert.equal(sections.concepts[0].name, "Partitioning");
  assert.match(formatted, /Measure hot keys/);
  assert.match(formatted, /Reads scale out/);
});
