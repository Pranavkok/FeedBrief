const BACKEND_URL = "http://127.0.0.1:8787/api/summarize";
const MAX_CHARS = 20_000;
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SUMMARIZE_TEXT") return;
  handleSummarize(message.payload)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((error) => sendResponse({ ok: false, error: safeMessage(error) }));
  return true;
});
async function handleSummarize(payload) {
  if (!payload || typeof payload.text !== "string") throw new Error("Invalid request.");
  const text = payload.text.trim();
  if (!text) throw new Error("Text cannot be empty.");
  if (text.length > MAX_CHARS) throw new Error("Text exceeds the 20,000 character limit.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(BACKEND_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, length: payload.length || "standard", tone: payload.tone || "neutral" }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Backend request failed (${response.status}).`);
    if (typeof body.summary !== "string" || !body.summary.trim()) throw new Error("Backend returned an invalid summary.");
    return { summary: body.summary, sections: body.sections, cached: Boolean(body.cached), durationMs: body.durationMs, model: body.model };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Request timed out. Try again.");
    if (error instanceof TypeError) throw new Error("Cannot reach the local backend. Start the server and try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function safeMessage(error) { return error instanceof Error ? error.message : "Unexpected error."; }
