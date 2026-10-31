import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { GoogleGenAI } from "@google/genai";
import { validatePostText } from "./validation.js";

const app = express();
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    // Chrome extension origins have this scheme. Requests without Origin are
    // allowed for local health checks; the server itself binds to loopback.
    if (!origin || origin.startsWith("chrome-extension://")) return callback(null, true);
    return callback(new Error("Origin not allowed."));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "64kb", strict: true }));
app.use("/api/", rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Wait a minute and try again." }
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/summarize", async (req, res) => {
  const validation = validatePostText(req.body?.text);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "GEMINI_API_KEY is not configured on the local server." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: [
        "Summarize the user-submitted professional social-media post. Preserve the author's main point and important caveats. Do not invent facts. Use concise plain language. If the post is unclear, say so.",
        validation.text
      ],
      config: { temperature: 0.2, maxOutputTokens: 350 }
    });

    const summary = response.text?.trim();
    if (!summary) return res.status(502).json({ error: "The model returned an empty response." });
    return res.json({ summary, model });
  } catch (error) {
    // Do not log submitted post text or secrets.
    console.error("Gemini request failed:", error?.status || error?.name || "unknown");
    return res.status(502).json({ error: "The AI provider request failed. Check server configuration and try again." });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON." });
  if (error?.message === "Origin not allowed.") return res.status(403).json({ error: "Origin not allowed." });
  return res.status(500).json({ error: "Internal server error." });
});

app.listen(port, host, () => {
  console.log(`Local summarization server listening on http://${host}:${port}`);
});
