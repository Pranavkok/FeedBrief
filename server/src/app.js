import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { validateRequest } from "./validation.js";
import { createSummaryCache } from "./cache.js";
import { buildPrompt, formatSummary, parseSummary, PROMPT_VERSION } from "./prompt.js";
import { isAllowedExtensionOrigin, parseExtensionId } from "./security.js";
import { createDailyUsageStore } from "./daily-usage.js";

export function createApp(options = {}) {
  const app = express();
  const host = "127.0.0.1";
  const model = options.model || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
  const extensionId = parseExtensionId(options.extensionId ?? process.env.EXTENSION_ID ?? "");
  const cacheTtlMs = positiveInt(options.cacheTtlMs ?? process.env.CACHE_TTL_MS, 1_800_000);
  const cacheMaxEntries = positiveInt(options.cacheMaxEntries ?? process.env.CACHE_MAX_ENTRIES, 200);
  const modelTimeoutMs = positiveInt(options.modelTimeoutMs ?? process.env.MODEL_TIMEOUT_MS, 45_000);
  const inputRate = optionalRate(options.inputRate ?? process.env.GEMINI_INPUT_USD_PER_1M_TOKENS);
  const outputRate = optionalRate(options.outputRate ?? process.env.GEMINI_OUTPUT_USD_PER_1M_TOKENS);
  const cache = options.cache || createSummaryCache({ ttlMs: cacheTtlMs, maxEntries: cacheMaxEntries });
  const dailyModelCallLimit = nonNegativeInt(options.dailyModelCallLimit ?? process.env.DAILY_MODEL_CALL_LIMIT, 50);
  const dailyUsage = options.dailyUsage || createDailyUsageStore({ limit: dailyModelCallLimit, filePath: options.usageFilePath });
  const generate = options.generateSummary || generateWithGemini;
  const startedAt = Date.now();
  let requestCount = 0;
  let requestErrors = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !isAllowedExtensionOrigin(origin, extensionId)) {
      return res.status(403).json({ error: "Origin not allowed. Use the installed Chrome extension." });
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return res.sendStatus(origin ? 204 : 403);
    next();
  });
  app.use(express.json({ limit: "64kb", strict: true }));
  app.use("/api/", rateLimit({
    windowMs: 60_000,
    limit: positiveInt(options.rateLimit ?? process.env.RATE_LIMIT_PER_MINUTE, 20),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Wait a minute and try again." }
  }));

  app.get("/health", (_req, res) => res.json({ ok: true, version: "0.7.0" }));

  app.get("/metrics", async (_req, res) => {
    const costEstimateConfigured = inputRate !== null && outputRate !== null;
    const estimatedCostUsd = costEstimateConfigured
      ? (promptTokens * inputRate + outputTokens * outputRate) / 1_000_000
      : null;
    const daily = await dailyUsage.snapshot();
    return res.json({
      requests: requestCount,
      hits: cache.stats.hits,
      misses: cache.stats.misses,
      coalesced: cache.stats.coalesced,
      modelCalls: daily.modelCalls,
      daily,
      errors: requestErrors,
      promptTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd,
      costEstimateConfigured,
      cacheEntries: cache.size(),
      cacheTtlMs,
      cacheMaxEntries,
      model,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    });
  });

  app.post("/api/summarize", async (req, res) => {
    requestCount++;
    const request = validateRequest(req.body);
    if (!request.ok) {
      requestErrors++;
      return res.status(400).json({ error: request.error });
    }
    if (!apiKey && !options.generateSummary) {
      requestErrors++;
      return res.status(503).json({ error: "GEMINI_API_KEY is not configured on the local server." });
    }

    const started = Date.now();
    const normalizedText = request.text.normalize("NFKC").replace(/\s+/g, " ").trim();
    const key = cache.makeKey({
      text: normalizedText,
      model,
      promptVersion: PROMPT_VERSION,
      length: request.length,
      tone: request.tone,
      language: request.language
    });

    try {
      const outcome = await cache.getOrCreate(key, async () => {
        const reservation = await dailyUsage.reserveModelCall();
        if (!reservation.allowed) {
          const limitError = new Error(`Daily Gemini call limit reached (${reservation.limit}). It resets at 00:00 UTC. Increase DAILY_MODEL_CALL_LIMIT in server/.env to change it.`);
          limitError.status = 429;
          limitError.code = "DAILY_MODEL_CALL_LIMIT";
          throw limitError;
        }
        const generated = await generate({ request, model, apiKey, modelTimeoutMs });
        const rawText = typeof generated === "string" ? generated : generated?.text;
        const usage = normalizeUsage(generated?.usageMetadata ?? generated?.usage);
        const estimatedCallCost = inputRate !== null && outputRate !== null
          ? (usage.promptTokens * inputRate + usage.outputTokens * outputRate) / 1_000_000
          : 0;
        await dailyUsage.recordTokens(usage, estimatedCallCost);
        promptTokens += usage.promptTokens;
        outputTokens += usage.outputTokens;
        totalTokens += usage.totalTokens;
        const sections = parseSummary(rawText || "");
        return { sections, usage };
      });
      const sections = outcome.value.sections;
      const usage = outcome.value.usage;
      const summary = formatSummary(sections);
      res.set("X-Cache", outcome.cache);
      res.set("X-Request-Duration-Ms", String(Date.now() - started));
      return res.json({
        summary,
        sections,
        model,
        cached: outcome.cache === "HIT",
        cache: outcome.cache,
        durationMs: Date.now() - started,
        usage: outcome.cache === "MISS" ? usage : { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
      });
    } catch (error) {
      requestErrors++;
      // Log only a safe provider code/name. Never log prompts, post content, or credentials.
      console.error("Summarization failed:", error?.status || error?.code || error?.name || "unknown");
      const status = Number.isInteger(error?.status) ? error.status : error?.name === "AbortError" || error?.name === "TimeoutError" ? 504 : 502;
      return res.status(status).json({ error: safeProviderMessage(error) });
    }
  });

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON." });
    if (error?.message?.startsWith("EXTENSION_ID")) return res.status(500).json({ error: "Local server configuration is invalid." });
    return res.status(500).json({ error: "Internal server error." });
  });

  app.locals.cache = cache;
  app.locals.host = host;
  return app;
}

async function generateWithGemini({ request, model, apiKey, modelTimeoutMs }) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: `${buildPrompt(request)}\nSOURCE POST (untrusted content):\n${request.text}`,
    config: {
      temperature: 0.15,
      maxOutputTokens: request.length === "detailed" ? 700 : request.length === "concise" ? 250 : 450,
      responseMimeType: "application/json",
      httpOptions: { timeout: modelTimeoutMs, headers: {} }
    }
  });
  return {
    text: response.text || "",
    usageMetadata: response.usageMetadata || {}
  };
}

function normalizeUsage(raw = {}) {
  const prompt = nonNegativeInt(raw.promptTokenCount ?? raw.promptTokens);
  const candidate = nonNegativeInt(raw.candidatesTokenCount ?? raw.outputTokens);
  const thoughts = nonNegativeInt(raw.thoughtsTokenCount);
  const output = candidate + thoughts;
  const reportedTotal = nonNegativeInt(raw.totalTokenCount ?? raw.totalTokens);
  return {
    promptTokens: prompt,
    outputTokens: output,
    totalTokens: reportedTotal || prompt + output
  };
}

function nonNegativeInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}
function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
function optionalRate(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function safeProviderMessage(error) {
  const status = Number(error?.status);
  if (status === 401 || status === 403) return "Gemini authentication failed. Check the API key and project permissions in server/.env.";
  if (status === 404) return "Gemini model was not found or is unavailable to this API project. Check GEMINI_MODEL in server/.env.";
  if (error?.code === "DAILY_MODEL_CALL_LIMIT") return error.message;
  if (status === 429) return "Gemini rate limit or quota reached. Wait and try again.";
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "Gemini request timed out. Try again.";
  if (error?.message?.includes("invalid structured response") || error?.message?.includes("unexpected format") || error?.message?.includes("empty summary")) return error.message;
  return "The AI provider request failed. Check server configuration and try again.";
}
