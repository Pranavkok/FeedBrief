const API_ROOT = "http://127.0.0.1:8787";
const MAX_CHARS = 20_000;
const REQUEST_TIMEOUT_MS = 55_000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_TEXT") {
    handleSummarize(message.payload)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((error) => sendResponse({ ok: false, error: safeMessage(error) }));
    return true;
  }
  if (message?.type === "GET_METRICS") {
    fetchMetrics()
      .then((metrics) => sendResponse({ ok: true, metrics }))
      .catch((error) => sendResponse({ ok: false, error: safeMessage(error) }));
    return true;
  }
});

async function handleSummarize(payload) {
  if (!payload || typeof payload.text !== "string") throw new Error("Invalid request. Paste the post text again.");
  const text = payload.text.trim();
  if (!text) throw new Error("Text cannot be empty.");
  if (text.length > MAX_CHARS) throw new Error(`Text exceeds the ${MAX_CHARS.toLocaleString()} character limit.`);

  const length = ["concise", "standard", "detailed"].includes(payload.length) ? payload.length : "standard";
  const tone = ["neutral", "simple", "technical"].includes(payload.tone) ? payload.tone : "neutral";
  const language = ["auto", "en", "hi", "mr", "hinglish"].includes(payload.language) ? payload.language : "auto";
  const body = await requestJson(`${API_ROOT}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, length, tone, language })
  });
  if (typeof body.summary !== "string" || !body.summary.trim()) throw new Error("The backend returned an empty summary. Try again.");
  return {
    summary: body.summary,
    sections: body.sections,
    cached: Boolean(body.cached),
    cache: body.cache || "MISS",
    durationMs: Number.isFinite(body.durationMs) ? body.durationMs : null,
    model: typeof body.model === "string" ? body.model : "",
    usage: body.usage || null
  };
}

async function fetchMetrics() {
  const body = await requestJson(`${API_ROOT}/metrics`, { method: "GET" });
  if (!body || typeof body !== "object") throw new Error("The backend returned invalid metrics.");
  return body;
}

async function requestJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(typeof body?.error === "string" ? body.error : `Local backend returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Request timed out. Check the local server and try again.");
    if (error instanceof TypeError) throw new Error("Cannot reach the local backend. Start the server and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function safeMessage(error) {
  return error instanceof Error ? error.message : "Unexpected error. Reload the extension and try again.";
}
