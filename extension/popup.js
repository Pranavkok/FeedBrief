const MAX_CHARS = 20_000;
const input = document.querySelector("#postText");
const count = document.querySelector("#charCount");
const submit = document.querySelector("#summarizeBtn");
const buttonLabel = submit.querySelector(".button-label");
const spinner = submit.querySelector(".spinner");
const status = document.querySelector("#status");
const resultSection = document.querySelector("#resultSection");
const result = document.querySelector("#result");
const lengthControl = document.querySelector("#length");
const toneControl = document.querySelector("#tone");
const resultInfo = document.querySelector("#resultInfo");
let lastSummary = "";

input.addEventListener("input", () => {
  count.textContent = `${input.value.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  input.value = ""; input.dispatchEvent(new Event("input"));
  resultSection.hidden = true; lastSummary = ""; setStatus("Cleared."); input.focus();
});

submit.addEventListener("click", async () => {
  const text = input.value.trim();
  resultSection.hidden = true;
  if (!text) return setStatus("Paste some post text first.", true);
  if (text.length > MAX_CHARS) return setStatus("Text exceeds the 20,000 character limit.", true);
  setBusy(true); setStatus("Generating your summary…");
  const started = performance.now();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_TEXT",
      payload: { text, length: lengthControl.value, tone: toneControl.value }
    });
    if (!response?.ok) throw new Error(response?.error || "Summarization failed.");
    lastSummary = response.summary;
    renderSummary(response.sections, response.summary);
    resultSection.hidden = false;
    const elapsed = response.durationMs ?? Math.round(performance.now() - started);
    resultInfo.textContent = `${response.cached ? "Cached" : "Generated"} · ${elapsed} ms`;
    setStatus(response.cached ? "Summary ready · served from cache." : "Summary ready.", false, true);
  } catch (error) {
    setStatus(error.message || "Something went wrong.", true);
  } finally { setBusy(false); }
});

function renderSummary(sections, fallback) {
  result.replaceChildren();
  if (!sections || typeof sections !== "object") {
    const p = document.createElement("p"); p.textContent = fallback; result.append(p); return;
  }
  addSection("TL;DR", sections.tldr, "p");
  if (Array.isArray(sections.keyTakeaways) && sections.keyTakeaways.length) {
    const heading = document.createElement("h3"); heading.textContent = "Key takeaways"; result.append(heading);
    const list = document.createElement("ul");
    for (const item of sections.keyTakeaways) { const li = document.createElement("li"); li.textContent = item; list.append(li); }
    result.append(list);
  }
  if (sections.whyItMatters) addSection("Why it matters", sections.whyItMatters, "p");
  if (!result.childElementCount) { const p = document.createElement("p"); p.textContent = fallback; result.append(p); }
}
function addSection(title, content, tag) {
  if (typeof content !== "string" || !content.trim()) return;
  const heading = document.createElement("h3"); heading.textContent = title;
  const body = document.createElement(tag); body.textContent = content; result.append(heading, body);
}
function setBusy(busy) { submit.disabled = busy; spinner.hidden = !busy; buttonLabel.textContent = busy ? "Summarizing…" : "Summarize post"; }
function setStatus(message, isError = false, isSuccess = false) { status.textContent = message; status.className = `status${isError ? " error" : isSuccess ? " success" : ""}`; }

document.querySelector("#copyBtn").addEventListener("click", async () => {
  if (!lastSummary) return;
  try { await navigator.clipboard.writeText(lastSummary); setStatus("Summary copied to clipboard.", false, true); }
  catch { setStatus("Clipboard unavailable. Select and copy the summary manually.", true); }
});
document.querySelector("#copySourceBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(input.value); setStatus("Original text copied.", false, true); }
  catch { setStatus("Clipboard unavailable.", true); }
});
