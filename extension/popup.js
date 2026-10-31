const MAX_CHARS = 20_000;
const MAX_HISTORY = 40;
const HISTORY_KEY = "tldrHistoryV5";
const PREFS_KEY = "tldrPreferencesV5";

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
const languageControl = document.querySelector("#language");
const saveHistoryControl = document.querySelector("#saveHistory");
const resultInfo = document.querySelector("#resultInfo");
const resultUsage = document.querySelector("#resultUsage");
const historyList = document.querySelector("#historyList");
let lastSummary = "";
let lastSections = null;
let lastResponse = null;
let busy = false;

void initialize();

async function initialize() {
  input.addEventListener("input", updateCount);
  document.querySelector("#clearBtn").addEventListener("click", clearInput);
  submit.addEventListener("click", summarize);
  document.querySelector("#copyBtn").addEventListener("click", copySummary);
  document.querySelector("#copySourceBtn").addEventListener("click", copySource);
  document.querySelector("#exportMdBtn").addEventListener("click", () => exportSummary("md"));
  document.querySelector("#exportTxtBtn").addEventListener("click", () => exportSummary("txt"));
  document.querySelector("#clearHistoryBtn").addEventListener("click", clearHistory);
  document.querySelector("#refreshUsageBtn").addEventListener("click", loadUsage);
  historyList.addEventListener("click", handleHistoryClick);
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  for (const control of [lengthControl, toneControl, languageControl, saveHistoryControl]) {
    control.addEventListener("change", savePreferences);
  }

  try {
    const stored = await chrome.storage.local.get([HISTORY_KEY, PREFS_KEY]);
    const prefs = stored[PREFS_KEY] || {};
    if (["concise", "standard", "detailed"].includes(prefs.length)) lengthControl.value = prefs.length;
    if (["neutral", "simple", "technical"].includes(prefs.tone)) toneControl.value = prefs.tone;
    if (["auto", "en", "hi", "mr", "hinglish"].includes(prefs.language)) languageControl.value = prefs.language;
    saveHistoryControl.checked = prefs.saveHistory === true;
    renderHistory(Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : []);
  } catch {
    setStatus("Local extension storage is unavailable. History and preferences may not persist.", true);
  }
  updateCount();
}

function updateCount() {
  count.textContent = `${input.value.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
}

function clearInput() {
  input.value = "";
  updateCount();
  resultSection.hidden = true;
  lastSummary = "";
  lastSections = null;
  lastResponse = null;
  setStatus("Cleared.");
  input.focus();
}

async function summarize() {
  if (busy) return;
  const text = input.value.trim();
  if (!text) return setStatus("Paste some post text first.", true);
  if (text.length > MAX_CHARS) return setStatus(`Text exceeds the ${MAX_CHARS.toLocaleString()} character limit.`, true);

  setBusy(true);
  setStatus("Generating your summary…");
  const started = performance.now();
  try {
    const response = await sendRuntimeMessage({
      type: "SUMMARIZE_TEXT",
      payload: {
        text,
        length: lengthControl.value,
        tone: toneControl.value,
        language: languageControl.value
      }
    });
    if (!response?.ok) throw new Error(response?.error || "Summarization failed.");

    lastSummary = response.summary;
    lastSections = response.sections || null;
    lastResponse = response;
    renderSummary(lastSections, lastSummary);
    resultSection.hidden = false;
    const elapsed = response.durationMs ?? Math.round(performance.now() - started);
    const sourceLabel = response.cache === "HIT" ? "Cache hit" : response.cache === "COALESCED" ? "Shared request" : "Generated";
    resultInfo.textContent = `${sourceLabel} · ${elapsed} ms`;
    resultUsage.textContent = formatUsage(response.usage);
    setStatus(response.cache === "HIT" ? "Summary ready · served from cache." : response.cache === "COALESCED" ? "Summary ready · shared an in-progress request." : "Summary ready.", false, true);

    if (saveHistoryControl.checked) {
      try {
        await saveHistory({
          id: createId(),
          createdAt: new Date().toISOString(),
          sourceText: text,
          summary: response.summary,
          sections: response.sections,
          settings: { length: lengthControl.value, tone: toneControl.value, language: languageControl.value },
          model: response.model || "",
          cached: Boolean(response.cached),
          usage: response.usage || null
        });
      } catch {
        setStatus("Summary ready, but the history could not be saved. Check extension storage space.", true);
      }
    }
  } catch (error) {
    setStatus(error?.message || "Something went wrong. Try again.", true);
  } finally {
    setBusy(false);
  }
}

function renderSummary(sections, fallback) {
  result.replaceChildren();
  if (!sections || typeof sections !== "object") {
    const p = document.createElement("p");
    p.textContent = fallback;
    result.append(p);
    return;
  }
  addSection("TL;DR", sections.tldr, "p");
  if (Array.isArray(sections.keyTakeaways) && sections.keyTakeaways.length) {
    const heading = document.createElement("h3");
    heading.textContent = "Key takeaways";
    result.append(heading);
    const list = document.createElement("ul");
    for (const item of sections.keyTakeaways) {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    }
    result.append(list);
  }
  if (sections.whyItMatters) addSection("Why it matters", sections.whyItMatters, "p");
  if (!result.childElementCount) {
    const p = document.createElement("p");
    p.textContent = fallback;
    result.append(p);
  }
}

function addSection(title, content, tag) {
  if (typeof content !== "string" || !content.trim()) return;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const body = document.createElement(tag);
  body.textContent = content;
  result.append(heading, body);
}

function setBusy(value) {
  busy = value;
  submit.disabled = value;
  spinner.hidden = !value;
  buttonLabel.textContent = value ? "Summarizing…" : "Summarize post";
  input.disabled = value;
  lengthControl.disabled = value;
  toneControl.disabled = value;
  languageControl.disabled = value;
}

function setStatus(message, isError = false, isSuccess = false) {
  status.textContent = message;
  status.className = `status${isError ? " error" : isSuccess ? " success" : ""}`;
}

async function copySummary() {
  if (!lastSummary) return;
  try {
    await navigator.clipboard.writeText(lastSummary);
    setStatus("Summary copied to clipboard.", false, true);
  } catch {
    setStatus("Clipboard unavailable. Select and copy the summary manually.", true);
  }
}

async function copySource() {
  try {
    await navigator.clipboard.writeText(input.value);
    setStatus("Original text copied.", false, true);
  } catch {
    setStatus("Clipboard unavailable.", true);
  }
}

function exportSummary(format) {
  if (!lastSummary) return;
  const content = format === "md" ? toMarkdown(lastSections, lastSummary) : lastSummary;
  const mime = format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `linkedin-tldr-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  setStatus(`Exported ${format.toUpperCase()} summary.`, false, true);
}

function toMarkdown(sections, fallback) {
  if (!sections || typeof sections !== "object") return `# Summary\n\n${fallback}\n`;
  const lines = ["# Summary", "", "## TL;DR", "", sections.tldr || fallback, ""];
  if (Array.isArray(sections.keyTakeaways) && sections.keyTakeaways.length) {
    lines.push("## Key takeaways", "", ...sections.keyTakeaways.map((item) => `- ${item}`), "");
  }
  if (sections.whyItMatters) lines.push("## Why it matters", "", sections.whyItMatters, "");
  return lines.join("\n");
}

async function saveHistory(entry) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const next = [entry, ...history.filter((item) => item?.id !== entry.id)].slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  renderHistory(next);
}

async function readHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
}

function renderHistory(history) {
  historyList.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No saved summaries yet. Turn on history before summarizing a post.";
    historyList.append(empty);
    return;
  }
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "history-item";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "history-open";
    open.dataset.action = "open";
    open.dataset.id = item.id;
    const title = document.createElement("strong");
    title.textContent = (item.sections?.tldr || item.summary || "Saved summary").slice(0, 110);
    const meta = document.createElement("small");
    meta.textContent = `${formatDate(item.createdAt)} · ${item.model || "Gemini"}`;
    open.append(title, meta);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-delete";
    remove.textContent = "Delete";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.setAttribute("aria-label", "Delete saved summary");
    row.append(open, remove);
    historyList.append(row);
  }
}

async function handleHistoryClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  const history = await readHistory();
  const item = history.find((entry) => entry.id === id);
  if (!item) return renderHistory(history);

  if (action === "delete") {
    const next = history.filter((entry) => entry.id !== id);
    await chrome.storage.local.set({ [HISTORY_KEY]: next });
    renderHistory(next);
    return;
  }
  if (action === "open") {
    input.value = item.sourceText || "";
    updateCount();
    if (item.settings) {
      lengthControl.value = item.settings.length || "standard";
      toneControl.value = item.settings.tone || "neutral";
      languageControl.value = item.settings.language || "auto";
    }
    lastSummary = item.summary || "";
    lastSections = item.sections || null;
    lastResponse = item;
    renderSummary(lastSections, lastSummary);
    resultSection.hidden = !lastSummary;
    resultInfo.textContent = `Saved · ${formatDate(item.createdAt)}`;
    resultUsage.textContent = formatUsage(item.usage);
    switchTab("summary");
    setStatus("Loaded a saved summary.", false, true);
  }
}

async function clearHistory() {
  if (!confirm("Delete all saved summaries from this device?")) return;
  await chrome.storage.local.remove(HISTORY_KEY);
  renderHistory([]);
  setStatus("Local history cleared.", false, true);
}

async function savePreferences() {
  const prefs = {
    length: lengthControl.value,
    tone: toneControl.value,
    language: languageControl.value,
    saveHistory: saveHistoryControl.checked
  };
  try { await chrome.storage.local.set({ [PREFS_KEY]: prefs }); }
  catch { setStatus("Could not save preferences locally.", true); }
}

function switchTab(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const panel of document.querySelectorAll("[data-panel]")) {
    const active = panel.dataset.panel === name;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  }
  if (name === "history") void readHistory().then(renderHistory).catch(() => {});
  if (name === "usage") void loadUsage();
}

async function loadUsage() {
  const button = document.querySelector("#refreshUsageBtn");
  button.disabled = true;
  document.querySelector("#usageStatus").textContent = "Loading local backend metrics…";
  try {
    const response = await sendRuntimeMessage({ type: "GET_METRICS" });
    if (!response?.ok) throw new Error(response?.error || "Could not load metrics.");
    const m = response.metrics;
    document.querySelector("#metricRequests").textContent = formatNumber(m.requests);
    document.querySelector("#metricCalls").textContent = formatNumber(m.modelCalls);
    document.querySelector("#metricCache").textContent = formatNumber(m.hits);
    document.querySelector("#metricTokens").textContent = formatNumber(m.totalTokens);
    document.querySelector("#metricCost").textContent = m.estimatedCostUsd == null ? "Not configured" : `$${Number(m.estimatedCostUsd).toFixed(6)}`;
    document.querySelector("#metricCostNote").textContent = m.costEstimateConfigured
      ? "Estimated from the token rates configured in server/.env; check your Google billing for exact charges."
      : "Set GEMINI_INPUT_USD_PER_1M_TOKENS and GEMINI_OUTPUT_USD_PER_1M_TOKENS in server/.env.";
    const denominator = Number(m.hits || 0) + Number(m.misses || 0) + Number(m.coalesced || 0);
    const hitRate = denominator ? (Number(m.hits || 0) / denominator * 100).toFixed(1) : "0.0";
    document.querySelector("#metricCacheRate").textContent = `Cache hit rate: ${hitRate}%`;
    document.querySelector("#metricModel").textContent = `Model: ${m.model || "—"}`;
    document.querySelector("#metricEntries").textContent = `Cached summaries: ${formatNumber(m.cacheEntries)}`;
    document.querySelector("#usageStatus").textContent = `Since backend start · ${formatNumber(m.errors)} errors · ${formatNumber(m.coalesced)} coalesced requests`;
  } catch (error) {
    document.querySelector("#usageStatus").textContent = error?.message || "Could not load metrics. Is the local server running?";
    for (const id of ["metricRequests", "metricCalls", "metricCache", "metricTokens", "metricCost"]) document.querySelector(`#${id}`).textContent = "—";
  } finally {
    button.disabled = false;
  }
}

async function sendRuntimeMessage(message) {
  try { return await chrome.runtime.sendMessage(message); }
  catch (error) {
    throw new Error(error?.message?.includes("Receiving end")
      ? "The extension service worker is unavailable. Reload the extension and try again."
      : "Could not communicate with the extension. Reload it and try again.");
  }
}

function formatUsage(usage) {
  if (!usage) return "";
  const inputTokens = Number(usage.promptTokens || 0);
  const outputTokens = Number(usage.outputTokens || 0);
  const total = Number(usage.totalTokens || inputTokens + outputTokens);
  return total ? `${formatNumber(total)} tokens` : "";
}
function formatNumber(value) { return Number(value || 0).toLocaleString(); }
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Saved" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function createId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
