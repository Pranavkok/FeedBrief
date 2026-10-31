export const MAX_CHARS = 20_000;
const LENGTHS = new Set(["concise", "standard", "detailed"]);
const TONES = new Set(["neutral", "simple", "technical"]);
const LANGUAGES = new Set(["auto", "en", "hi", "mr", "hinglish"]);
const MODES = new Set(["general", "beginner", "technical", "executive"]);
const MODEL_PREFERENCES = new Set(["auto", "fast", "quality"]);
const PROVIDERS = new Set(["auto", "gemini", "openai", "anthropic"]);
const EXPERTISE = new Set(["auto", "beginner", "intermediate", "advanced"]);
const ALLOWED_KEYS = new Set(["text", "length", "tone", "language", "mode", "provider", "modelPreference", "profile"]);

export function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Request body must be a JSON object." };
  for (const key of Object.keys(body)) if (!ALLOWED_KEYS.has(key)) return { ok: false, error: `Unexpected request field: ${key}.` };
  if (typeof body.text !== "string") return { ok: false, error: "Text must be a string." };
  const text = body.text.trim();
  if (!text) return { ok: false, error: "Text cannot be empty." };
  if (text.length > MAX_CHARS) return { ok: false, error: `Text exceeds ${MAX_CHARS.toLocaleString()} characters.` };

  const length = body.length ?? "standard";
  const tone = body.tone ?? "neutral";
  const language = body.language ?? "auto";
  const mode = body.mode ?? "general";
  const provider = body.provider ?? "auto";
  const modelPreference = body.modelPreference ?? "auto";
  if (!LENGTHS.has(length)) return { ok: false, error: "Invalid summary length." };
  if (!TONES.has(tone)) return { ok: false, error: "Invalid writing style." };
  if (!LANGUAGES.has(language)) return { ok: false, error: "Unsupported summary language." };
  if (!MODES.has(mode)) return { ok: false, error: "Unsupported summary mode." };
  if (!PROVIDERS.has(provider)) return { ok: false, error: "Unsupported AI provider." };
  if (!MODEL_PREFERENCES.has(modelPreference)) return { ok: false, error: "Unsupported model preference." };

  const profile = body.profile ?? {};
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return { ok: false, error: "Profile must be an object." };
  for (const key of Object.keys(profile)) if (!["expertise", "focusAreas", "feedbackHints"].includes(key)) return { ok: false, error: `Unexpected profile field: ${key}.` };
  const expertise = profile.expertise ?? "auto";
  const focusAreas = profile.focusAreas ?? "";
  const feedbackHints = profile.feedbackHints ?? "";
  if (!EXPERTISE.has(expertise)) return { ok: false, error: "Invalid expertise level." };
  if (typeof focusAreas !== "string" || focusAreas.length > 120) return { ok: false, error: "Focus areas must be text with at most 120 characters." };
  if (typeof feedbackHints !== "string" || feedbackHints.length > 240) return { ok: false, error: "Feedback guidance must be text with at most 240 characters." };

  return { ok: true, text, length, tone, language, mode, provider, modelPreference, profile: { expertise, focusAreas: focusAreas.trim(), feedbackHints: feedbackHints.trim() } };
}
