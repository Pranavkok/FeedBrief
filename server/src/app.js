import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { validateRequest } from "./validation.js";
import { createSummaryCache } from "./cache.js";
import { formatSummary, parseSummary, PROMPT_VERSION } from "./prompt.js";
import { isAllowedExtensionOrigin, parseExtensionId } from "./security.js";
import { createDailyUsageStore } from "./daily-usage.js";
import { createProviderRegistry } from "./providers.js";
import { resolveModelRoute } from "./model-router.js";

export function createApp(options = {}) {
  const app = express();
  const host = "127.0.0.1";
  const env = options.env || process.env;
  const extensionId = parseExtensionId(options.extensionId ?? env.EXTENSION_ID ?? "");
  const cacheTtlMs = positiveInt(options.cacheTtlMs ?? env.CACHE_TTL_MS, 1_800_000);
  const cacheMaxEntries = positiveInt(options.cacheMaxEntries ?? env.CACHE_MAX_ENTRIES, 200);
  const modelTimeoutMs = positiveInt(options.modelTimeoutMs ?? env.MODEL_TIMEOUT_MS, 45_000);
  const globalInputRate = options.inputRate !== undefined ? optionalRate(options.inputRate) : optionalRate(env.AI_INPUT_USD_PER_1M_TOKENS);
  const globalOutputRate = options.outputRate !== undefined ? optionalRate(options.outputRate) : optionalRate(env.AI_OUTPUT_USD_PER_1M_TOKENS);
  const cache = options.cache || createSummaryCache({ ttlMs: cacheTtlMs, maxEntries: cacheMaxEntries });
  const dailyModelCallLimit = nonNegativeInt(options.dailyModelCallLimit ?? env.DAILY_MODEL_CALL_LIMIT, 50);
  const dailyUsage = options.dailyUsage || createDailyUsageStore({ limit: dailyModelCallLimit, filePath: options.usageFilePath });
  const providers = options.providers || createProviderRegistry({ env, fetchImpl: options.fetchImpl });
  const generateOverride = options.generateSummary;
  const startedAt = Date.now();
  let requestCount = 0;
  let requestErrors = 0;
  let promptTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let estimatedCostUsd = 0;
  let lastRoute = null;

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
    limit: positiveInt(options.rateLimit ?? env.RATE_LIMIT_PER_MINUTE, 20),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Wait a minute and try again." }
  }));

  app.get("/health", (_req, res) => res.json({ ok: true, version: "0.9.0" }));

  app.get("/api/capabilities", (_req, res) => {
    const capabilities = providers.getCapabilities();
    return res.json({
      ...capabilities,
      summaryModes: ["general", "beginner", "technical", "executive"],
      languages: ["auto", "en", "hi", "mr", "hinglish"],
      modelPreferences: ["auto", "fast", "quality"]
    });
  });

  app.get("/metrics", async (_req, res) => {
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
      costEstimateConfigured: daily.modelCalls > 0 && daily.unpricedCalls === 0,
      costEstimateIncomplete: daily.unpricedCalls > 0,
      cacheEntries: cache.size(),
      cacheTtlMs,
      cacheMaxEntries,
      model: lastRoute?.model || env.GEMINI_MODEL || "—",
      provider: lastRoute?.provider || env.AI_DEFAULT_PROVIDER || "—",
      configuredProviders: providers.listConfigured().map((item) => item.id),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
    });
  });

  app.post("/api/summarize", async (req, res) => {
    requestCount++;
    const validated = validateRequest(req.body);
    if (!validated.ok) {
      requestErrors++;
      return res.status(400).json({ error: validated.error });
    }

    let route;
    try {
      route = generateOverride
        ? { provider: validated.provider === "auto" ? "test" : validated.provider, model: options.model || "test-model", routeKind: validated.modelPreference }
        : resolveModelRoute(validated, providers, env);
    } catch (error) {
      requestErrors++;
      return res.status(Number.isInteger(error.status) ? error.status : 503).json({ error: safeProviderMessage(error) });
    }

    const started = Date.now();
    const normalizedText = validated.text.normalize("NFKC").replace(/\s+/g, " ").trim();
    const key = cache.makeKey({
      text: normalizedText,
      provider: route.provider,
      model: route.model,
      routeKind: route.routeKind,
      promptVersion: PROMPT_VERSION,
      length: validated.length,
      tone: validated.tone,
      language: validated.language,
      mode: validated.mode,
      profile: validated.profile
    });

    try {
      const outcome = await cache.getOrCreate(key, async () => {
        const reservation = await dailyUsage.reserveModelCall();
        if (!reservation.allowed) {
          const limitError = new Error(`Daily AI model-call limit reached (${reservation.limit}). It resets at 00:00 UTC. Change DAILY_MODEL_CALL_LIMIT in server/.env to adjust it.`);
          limitError.status = 429;
          limitError.code = "DAILY_MODEL_CALL_LIMIT";
          throw limitError;
        }
        let usageRecorded = false;
        try {
          const generated = generateOverride
            ? await generateOverride({ request: validated, model: route.model, apiKey: env.GEMINI_API_KEY || "", modelTimeoutMs, route })
            : await providers.generate({ request: validated, route, timeoutMs: modelTimeoutMs });
          const rawText = typeof generated === "string" ? generated : generated?.text;
          const usage = normalizeUsage(generated?.usageMetadata ?? generated?.usage);
          const rates = getProviderRates(env, route.provider, globalInputRate, globalOutputRate);
          const hasRates = rates.input !== null && rates.output !== null;
          const estimatedCallCost = hasRates
            ? (usage.promptTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000
            : 0;
          await dailyUsage.recordTokens(usage, estimatedCallCost, hasRates);
          usageRecorded = true;
          if (hasRates) estimatedCostUsd += estimatedCallCost;
          promptTokens += usage.promptTokens;
          outputTokens += usage.outputTokens;
          totalTokens += usage.totalTokens;
          const sections = parseSummary(rawText || "");
          return { sections, usage, route };
        } catch (error) {
          if (!usageRecorded) await dailyUsage.recordUnpricedCall().catch(() => {});
          throw error;
        }
      });
      const { sections, usage, route: usedRoute } = outcome.value;
      lastRoute = usedRoute;
      const summary = formatSummary(sections);
      res.set("X-Cache", outcome.cache);
      res.set("X-Request-Duration-Ms", String(Date.now() - started));
      return res.json({
        summary,
        sections,
        provider: usedRoute.provider,
        model: usedRoute.model,
        routeKind: usedRoute.routeKind,
        cached: outcome.cache === "HIT",
        cache: outcome.cache,
        durationMs: Date.now() - started,
        usage: outcome.cache === "MISS" ? usage : { promptTokens: 0, outputTokens: 0, totalTokens: 0 }
      });
    } catch (error) {
      requestErrors++;
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
  app.locals.providers = providers;
  return app;
}

function normalizeUsage(raw = {}) {
  const prompt = nonNegativeInt(raw.promptTokenCount ?? raw.promptTokens);
  const candidate = nonNegativeInt(raw.candidatesTokenCount ?? raw.outputTokens);
  const thoughts = nonNegativeInt(raw.thoughtsTokenCount);
  const output = candidate + thoughts;
  const reportedTotal = nonNegativeInt(raw.totalTokenCount ?? raw.totalTokens);
  return { promptTokens: prompt, outputTokens: output, totalTokens: reportedTotal || prompt + output };
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
function getProviderRates(env, provider, globalInputRate, globalOutputRate) {
  const prefix = String(provider || "").toUpperCase();
  const input = globalInputRate ?? optionalRate(env[`${prefix}_INPUT_USD_PER_1M_TOKENS`]);
  const output = globalOutputRate ?? optionalRate(env[`${prefix}_OUTPUT_USD_PER_1M_TOKENS`]);
  return { input, output };
}
function safeProviderMessage(error) {
  if (error?.code === "NO_PROVIDER_CONFIGURED") return error.message;
  if (error?.code === "PROVIDER_NOT_CONFIGURED") return error.message;
  const status = Number(error?.status);
  if (status === 401 || status === 403) return "AI provider authentication failed. Check the selected provider API key and permissions in server/.env.";
  if (status === 404) return "The selected AI model was not found or is unavailable to your API project. Check its model name in server/.env.";
  if (error?.code === "DAILY_MODEL_CALL_LIMIT") return error.message;
  if (status === 429) return "The AI provider rate limit or quota was reached. Wait and try again.";
  if (status === 400) return error.message || "The AI provider rejected the request. Check its model configuration.";
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "The AI provider request timed out. Try again.";
  if (error?.message?.includes("invalid structured response") || error?.message?.includes("unexpected format") || error?.message?.includes("empty summary")) return error.message;
  return "The AI provider request failed. Check server configuration and try again.";
}
