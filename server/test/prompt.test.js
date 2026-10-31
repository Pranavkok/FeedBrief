import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseSummary, formatSummary } from "../src/prompt.js";

test("prompt includes grounded JSON, selected length, style and language", () => {
  const prompt = buildPrompt({ length: "concise", tone: "simple", language: "mr" });
  assert.match(prompt, /valid JSON/);
  assert.match(prompt, /one sentence/);
  assert.match(prompt, /plain everyday language/);
  assert.match(prompt, /natural Marathi/);
});

test("parses structured output and formats a readable summary", () => {
  const sections = parseSummary(JSON.stringify({ tldr: "Main point.", keyTakeaways: ["Fact one", "Fact two"], whyItMatters: "It may matter." }));
  assert.match(formatSummary(sections), /TL;DR/);
  assert.equal(sections.keyTakeaways.length, 2);
});

test("rejects malformed or empty model output", () => {
  assert.throws(() => parseSummary("not json"));
  assert.throws(() => parseSummary(JSON.stringify({ tldr: "  " })));
});

test("bounds and filters model fields", () => {
  const sections = parseSummary(JSON.stringify({
    tldr: "x".repeat(900), keyTakeaways: ["", "ok", ...Array(8).fill("extra")], whyItMatters: 3
  }));
  assert.equal(sections.tldr.length, 700);
  assert.equal(sections.keyTakeaways.length, 5);
  assert.equal(sections.whyItMatters, "");
});
