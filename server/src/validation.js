export const MAX_CHARS = 20_000;
const LENGTHS = new Set(["concise", "standard", "detailed"]);
const TONES = new Set(["neutral", "technical"]);
export function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Request body must be a JSON object." };
  if (typeof body.text !== "string") return { ok: false, error: "Text must be a string." };
  const text = body.text.trim();
  if (!text) return { ok: false, error: "Text cannot be empty." };
  if (text.length > MAX_CHARS) return { ok: false, error: `Text exceeds ${MAX_CHARS} characters.` };
  const length = body.length ?? "standard";
  const tone = body.tone ?? "neutral";
  if (!LENGTHS.has(length)) return { ok: false, error: "Invalid summary length." };
  if (!TONES.has(tone)) return { ok: false, error: "Invalid writing style." };
  return { ok: true, text, length, tone };
}
