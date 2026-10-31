import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseSummary, formatSummary } from "../src/prompt.js";
test("prompt includes grounded JSON and selected controls", () => { const p = buildPrompt({ length: "concise", tone: "technical" }); assert.match(p, /valid JSON/); assert.match(p, /one sentence/); assert.match(p, /technical language/); });
test("parses structured output and formats readable summary", () => { const sections = parseSummary(JSON.stringify({ tldr: "Main point.", keyTakeaways: ["Fact one", "Fact two"], whyItMatters: "It may matter." })); assert.match(formatSummary(sections), /TL;DR/); assert.equal(sections.keyTakeaways.length, 2); });
test("rejects malformed or empty model output", () => { assert.throws(() => parseSummary("not json")); assert.throws(() => parseSummary(JSON.stringify({ tldr: "  " }))); });
test("bounds and filters model fields", () => { const s = parseSummary(JSON.stringify({ tldr: "x".repeat(900), keyTakeaways: ["", "ok", ...Array(8).fill("extra")], whyItMatters: 3 })); assert.equal(s.tldr.length, 700); assert.equal(s.keyTakeaways.length, 5); assert.equal(s.whyItMatters, ""); });
