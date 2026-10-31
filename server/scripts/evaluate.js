import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreEvaluation } from "../src/evaluation-score.js";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = resolve(serverDir, "..");
const datasetPath = resolve(serverDir, "evaluation", "scenarios.json");
const outputDir = resolve(serverDir, "data");
const outputPath = resolve(outputDir, "evaluation-report.json");
const baseUrl = process.env.EVAL_BASE_URL || "http://127.0.0.1:8787";
const maxCases = clampInt(process.env.EVAL_MAX_CASES, 4, 1, 20);

const scenarios = JSON.parse(await readFile(datasetPath, "utf8")).slice(0, maxCases);
const results = [];
console.log(`Running ${scenarios.length} evaluation cases against ${baseUrl}. Each cache miss can consume one provider call.`);

for (const scenario of scenarios) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: scenario.sourceText,
        length: "standard",
        tone: "neutral",
        language: "auto",
        mode: scenario.mode,
        provider: "auto",
        modelPreference: "auto",
        profile: { expertise: "intermediate", focusAreas: "software engineering", feedbackHints: "" }
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    const score = scoreEvaluation({ sections: body.sections, expectedTerms: scenario.expectedTerms, sourceText: scenario.sourceText });
    results.push({
      id: scenario.id,
      ok: true,
      provider: body.provider,
      model: body.model,
      cache: body.cache,
      durationMs: Date.now() - startedAt,
      score
      // Keep the report content-free; do not persist source posts or model output text.
    });
    console.log(`${scenario.id}: ${score.score}/100 · ${score.coverage}% term coverage · ${body.provider}/${body.model}`);
  } catch (error) {
    results.push({ id: scenario.id, ok: false, error: String(error.message || "Evaluation failed").slice(0, 240) });
    console.error(`${scenario.id}: failed — ${error.message}`);
  }
}

const completed = results.filter((result) => result.ok);
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  caseCount: scenarios.length,
  completedCount: completed.length,
  averageScore: completed.length ? Number((completed.reduce((sum, result) => sum + result.score.score, 0) / completed.length).toFixed(1)) : null,
  results
};
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(`\nReport saved to ${outputPath}`);
console.log("This is a deterministic smoke rubric, not a full human or model-as-judge quality assessment.");
if (completed.length !== scenarios.length) process.exitCode = 1;

function clampInt(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
