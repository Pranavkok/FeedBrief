import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { validateRequest } from "./validation.js";
import { createSummaryCache } from "./cache.js";
import { buildPrompt, formatSummary, parseSummary, PROMPT_VERSION } from "./prompt.js";

const app = express();
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const cache = createSummaryCache({ ttlMs: positiveInt(process.env.CACHE_TTL_MS, 1_800_000), maxEntries: positiveInt(process.env.CACHE_MAX_ENTRIES, 200) });
app.disable("x-powered-by");
app.use(cors({ origin(origin, callback) { if (!origin || origin.startsWith("chrome-extension://")) return callback(null, true); return callback(new Error("Origin not allowed.")); }, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "64kb", strict: true }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests. Wait a minute and try again." } }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/metrics", (_req, res) => res.json({ ...cache.stats, cacheEntries: cache.size(), cacheTtlMs: positiveInt(process.env.CACHE_TTL_MS, 1_800_000), cacheMaxEntries: positiveInt(process.env.CACHE_MAX_ENTRIES, 200) }));

app.post("/api/summarize", async (req, res) => {
  const request = validateRequest(req.body);
  if (!request.ok) return res.status(400).json({ error: request.error });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "GEMINI_API_KEY is not configured on the local server." });
  const started = Date.now();
  const key = cache.makeKey({ text: request.text.replace(/\s+/g, " ").trim(), model, promptVersion: PROMPT_VERSION, length: request.length, tone: request.tone });
  try {
    const outcome = await cache.getOrCreate(key, async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model,
        contents: `${buildPrompt(request)}\nSOURCE POST (untrusted content):\n${request.text}`,
        config: { temperature: 0.15, maxOutputTokens: request.length === "detailed" ? 650 : 400, responseMimeType: "application/json" }
      });
      return parseSummary(response.text || "");
    });
    const summary = formatSummary(outcome.value);
    res.set("X-Cache", outcome.cache);
    return res.json({ summary, sections: outcome.value, model, cached: outcome.cache !== "MISS", cache: outcome.cache, durationMs: Date.now() - started });
  } catch (error) {
    // Log only provider status/code; never log submitted content or credentials.
    console.error("Summarization failed:", error?.status || error?.code || error?.name || "unknown");
    return res.status(502).json({ error: safeProviderMessage(error) });
  }
});
app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON." });
  if (error?.message === "Origin not allowed.") return res.status(403).json({ error: "Origin not allowed." });
  return res.status(500).json({ error: "Internal server error." });
});
app.listen(port, host, () => console.log(`Local summarization server listening on http://${host}:${port}`));
function positiveInt(value, fallback) { const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? number : fallback; }
function safeProviderMessage(error) {
  const status = Number(error?.status);
  if (status === 401 || status === 403) return "Gemini authentication failed. Check the API key and project permissions in server/.env.";
  if (status === 404) return "Gemini model was not found or is unavailable to this API project. Check GEMINI_MODEL in server/.env.";
  if (status === 429) return "Gemini rate limit or quota reached. Wait and try again.";
  if (error?.name === "AbortError") return "Gemini request timed out. Try again.";
  return "The AI provider request failed. Check server configuration and try again.";
}
