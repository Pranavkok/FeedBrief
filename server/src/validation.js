export const MAX_CHARS = 20_000;
const LENGTHS = new Set(["concise", "standard", "detailed"]);
const TONES = new Set(["neutral", "simple", "technical"]);
const LANGUAGES = new Set(["auto", "en", "hi", "mr", "hinglish"]);
const ALLOWED_KEYS = new Set(["text", "length", "tone", "language"]);

export function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) return { ok: false, error: `Unexpected request field: ${key}.` };
  }
  if (typeof body.text !== "string") return { ok: false, error: "Text must be a string." };
  const text = body.text.trim();
  if (!text) return { ok: false, error: "Text cannot be empty." };
  if (text.length > MAX_CHARS) return { ok: false, error: `Text exceeds ${MAX_CHARS.toLocaleString()} characters.` };

  const length = body.length ?? "standard";
  const tone = body.tone ?? "neutral";
  const language = body.language ?? "auto";
  if (!LENGTHS.has(length)) return { ok: false, error: "Invalid summary length." };
  if (!TONES.has(tone)) return { ok: false, error: "Invalid writing style." };
  if (!LANGUAGES.has(language)) return { ok: false, error: "Unsupported summary language." };
  return { ok: true, text, length, tone, language };
}
