export const MAX_CHARS = 20_000;

export function validatePostText(value) {
  if (typeof value !== "string") return { ok: false, error: "Text must be a string." };
  const text = value.trim();
  if (!text) return { ok: false, error: "Text cannot be empty." };
  if (text.length > MAX_CHARS) return { ok: false, error: `Text exceeds ${MAX_CHARS} characters.` };
  return { ok: true, text };
}
