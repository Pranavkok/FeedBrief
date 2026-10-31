import { searchHistory } from "./history-search.js";

const MAX_CHARS = 20_000;
const MAX_HISTORY = 40;
const MAX_FEEDBACK = 100;
const HISTORY_KEY = "tldrHistoryV5";
const PREFS_KEY = "tldrPreferencesV5";
const CONSENT_KEY = "tldrAiDisclosureAcceptedV9";
const FEEDBACK_KEY = "tldrFeedbackV6";

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
const summaryModeControl = document.querySelector("#summaryMode");
const providerControl = document.querySelector("#provider");
const modelPreferenceControl = document.querySelector("#modelPreference");
const expertiseControl = document.querySelector("#expertise");
const focusAreasControl = document.querySelector("#focusAreas");
const applyFeedbackControl = document.querySelector("#applyFeedback");
const historySearchControl = document.querySelector("#historySearch");
const saveHistoryControl = document.querySelector("#saveHistory");
const retentionControl = document.querySelector("#retentionDays");
const consentCard = document.querySelector("#consentCard");
const consentCheck = document.querySelector("#consentCheck");
const resultInfo = document.querySelector("#resultInfo");
const resultUsage = document.querySelector("#resultUsage");
const historyList = document.querySelector("#historyList");
let lastSummary = "";
let lastSections = null;
let lastResponse = null;
let currentResultId = "";
let consentAccepted = false;
let busy = false;

void initialize();

async function initialize() {
  updateConsentUI();
  input.addEventListener("input", updateCount);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      void summarize();
    }
  });
  document.querySelector("#clearBtn").addEventListener("click", clearInput);
  submit.addEventListener("click", summarize);
  document.querySelector("#copyBtn").addEventListener("click", copySummary);
  document.querySelector("#copySourceBtn").addEventListener("click", copySource);
  document.querySelector("#exportMdBtn").addEventListener("click", () => exportSummary("md"));
  document.querySelector("#exportTxtBtn").addEventListener("click", () => exportSummary("txt"));
  document.querySelector("#clearHistoryBtn").addEventListener("click", clearHistory);
  document.querySelector("#refreshUsageBtn").addEventListener("click", loadUsage);
  document.querySelector("#exportDataBtn").addEventListener("click", exportLocalData);
  document.querySelector("#clearAllDataBtn").addEventListener("click", clearAllLocalData);
  historyList.addEventListener("click", handleHistoryClick);
  historySearchControl.addEventListener("input", () => { void readHistory().then(renderHistory); });
  document.querySelector("#feedbackRow").addEventListener("click", handleFeedbackClick);
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  for (const control of [lengthControl, toneControl, languageControl, summaryModeControl, providerControl, modelPreferenceControl,
    saveHistoryControl, retentionControl, expertiseControl, applyFeedbackControl]) {
    control.addEventListener("change", savePreferences);
  }
  focusAreasControl.addEventListener("change", savePreferences);
  consentCheck.addEventListener("change", saveConsent);

  try {
    const stored = await chrome.storage.local.get([HISTORY_KEY, PREFS_KEY, CONSENT_KEY]);
    const prefs = stored[PREFS_KEY] || {};
    if (["concise", "standard", "detailed"].includes(prefs.length)) lengthControl.value = prefs.length;
    if (["neutral", "simple", "technical"].includes(prefs.tone)) toneControl.value = prefs.tone;
    if (["auto", "en", "hi", "mr", "hinglish"].includes(prefs.language)) languageControl.value = prefs.language;
    if (["general", "beginner", "technical", "executive"].includes(prefs.summaryMode)) summaryModeControl.value = prefs.summaryMode;
    if (["auto", "gemini", "openai", "anthropic"].includes(prefs.provider)) providerControl.value = prefs.provider;
    if (["auto", "fast", "quality"].includes(prefs.modelPreference)) modelPreferenceControl.value = prefs.modelPreference;
    if (["auto", "beginner", "intermediate", "advanced"].includes(prefs.expertise)) expertiseControl.value = prefs.expertise;
    if (typeof prefs.focusAreas === "string") focusAreasControl.value = prefs.focusAreas.slice(0, 120);
    applyFeedbackControl.checked = prefs.applyFeedback === true;
    if ([7, 30, 90, 0].includes(Number(prefs.retentionDays))) retentionControl.value = String(prefs.retentionDays);
    saveHistoryControl.checked = prefs.saveHistory === true;
    consentAccepted = stored[CONSENT_KEY] === true;
    consentCheck.checked = consentAccepted;
    updateConsentUI();
    const existingHistory = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
    const cleanHistory = pruneHistory(existingHistory);
    renderHistory(cleanHistory);
    if (cleanHistory.length !== existingHistory.length) await chrome.storage.local.set({ [HISTORY_KEY]: cleanHistory });
  } catch {
    updateConsentUI();
    setStatus("Local extension storage is unavailable. Enable extension storage to continue.", true);
  }
  updateCount();
  await loadCapabilities();
  await loadFeedbackInsights();
}

function updateConsentUI() {
  consentCard.hidden = consentAccepted;
  submit.disabled = !consentAccepted || busy;
  if (consentAccepted) setStatus("Ready when you are.");
}

async function saveConsent() {
  consentAccepted = consentCheck.checked;
  try {
    if (consentAccepted) await chrome.storage.local.set({ [CONSENT_KEY]: true });
    else await chrome.storage.local.remove(CONSENT_KEY);
    updateConsentUI();
    if (consentAccepted) setStatus("Thanks. Paste a post when you're ready.", false, true);
  } catch {
    consentAccepted = false;
    consentCheck.checked = false;
    updateConsentUI();
    setStatus("Could not save your privacy confirmation locally.", true);
  }
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
  currentResultId = "";
  setStatus("Cleared.");
  input.focus();
}

async function summarize() {
  if (busy || !consentAccepted) return;
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
        language: languageControl.value,
        mode: summaryModeControl.value,
        provider: providerControl.value,
        modelPreference: modelPreferenceControl.value,
        profile: {
          expertise: expertiseControl.value,
          focusAreas: focusAreasControl.value.trim(),
          feedbackHints: applyFeedbackControl.checked ? await getFeedbackGuidance() : ""
        }
      }
    });
    if (!response?.ok) throw new Error(response?.error || "Summarization failed.");

    lastSummary = response.summary;
    lastSections = response.sections || null;
    lastResponse = response;
    currentResultId = createId();
    renderSummary(lastSections, lastSummary);
    resultSection.hidden = false;
    resetFeedbackState();
    const elapsed = response.durationMs ?? Math.round(performance.now() - started);
    const sourceLabel = response.cache === "HIT" ? "Cache hit" : response.cache === "COALESCED" ? "Shared request" : "Generated";
    const selectedModel = [response.provider, response.model].filter(Boolean).join(" / ");
    resultInfo.textContent = `${sourceLabel} · ${elapsed} ms${selectedModel ? ` · ${selectedModel}` : ""}`;
    resultUsage.textContent = formatUsage(response.usage);
    setStatus(response.cache === "HIT" ? "Summary ready · served from cache." : response.cache === "COALESCED" ? "Summary ready · shared an in-progress request." : "Summary ready.", false, true);

    if (saveHistoryControl.checked) {
      try {
        await saveHistory({
          id: currentResultId,
          createdAt: new Date().toISOString(),
          sourceText: text,
          summary: response.summary,
          sections: response.sections,
          settings: { length: lengthControl.value, tone: toneControl.value, language: languageControl.value,
            summaryMode: summaryModeControl.value, provider: providerControl.value, modelPreference: modelPreferenceControl.value,
            profile: { expertise: expertiseControl.value, focusAreas: focusAreasControl.value.trim() } },
          model: response.model || "",
          provider: response.provider || "",
          cached: Boolean(response.cached),
          usage: response.usage || null
        });
      } catch {
        setStatus("Summary ready, but history could not be saved. Check extension storage space.", true);
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
  addStringList("Key takeaways", sections.keyTakeaways);
  addSection("Why it matters", sections.whyItMatters, "p");
  addObjectList("Concepts", sections.concepts, "name", "explanation");
  addObjectList("Claims", sections.claims, "claim", "qualification");
  addStringList("Examples from the post", sections.examples);
  addStringList("Caveats", sections.caveats);
  addStringList("Author's action items", sections.actionItems);
  if (!result.childElementCount) {
    const p = document.createElement("p");
    p.textContent = fallback;
    result.append(p);
  }
}

function addStringList(title, values) {
  if (!Array.isArray(values) || !values.length) return;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const li = document.createElement("li");
    li.textContent = value;
    list.append(li);
  }
  if (list.childElementCount) result.append(heading, list);
}

function addObjectList(title, values, primaryKey, secondaryKey) {
  if (!Array.isArray(values) || !values.length) return;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  for (const item of values) {
    const primary = typeof item?.[primaryKey] === "string" ? item[primaryKey].trim() : "";
    const secondary = typeof item?.[secondaryKey] === "string" ? item[secondaryKey].trim() : "";
    if (!primary) continue;
    const li = document.createElement("li");
    li.textContent = secondary ? `${primary}: ${secondary}` : primary;
    list.append(li);
  }
  if (list.childElementCount) result.append(heading, list);
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
  submit.disabled = value || !consentAccepted;
  spinner.hidden = !value;
  buttonLabel.textContent = value ? "Summarizing…" : "Summarize post";
  input.disabled = value;
  lengthControl.disabled = value;
  toneControl.disabled = value;
  languageControl.disabled = value;
  summaryModeControl.disabled = value;
  providerControl.disabled = value;
  modelPreferenceControl.disabled = value;
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
  downloadFile(content, `linkedin-tldr-${new Date().toISOString().slice(0, 10)}.${format}`, format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
  setStatus(`Exported ${format.toUpperCase()} summary.`, false, true);
}

function toMarkdown(sections, fallback) {
  if (!sections || typeof sections !== "object") return `# Summary\n\n${fallback}\n`;
  const lines = ["# Summary", "", "## TL;DR", "", sections.tldr || fallback, ""];
  appendMarkdownList(lines, "Key takeaways", sections.keyTakeaways);
  if (sections.whyItMatters) lines.push("## Why it matters", "", sections.whyItMatters, "");
  appendMarkdownObjects(lines, "Concepts", sections.concepts, "name", "explanation");
  appendMarkdownObjects(lines, "Claims", sections.claims, "claim", "qualification");
  appendMarkdownList(lines, "Examples from the post", sections.examples);
  appendMarkdownList(lines, "Caveats", sections.caveats);
  appendMarkdownList(lines, "Author's action items", sections.actionItems);
  return lines.join("\n");
}

function appendMarkdownList(lines, title, values = []) {
  if (Array.isArray(values) && values.length) lines.push(`## ${title}`, "", ...values.map((value) => `- ${value}`), "");
}
function appendMarkdownObjects(lines, title, values = [], primaryKey, secondaryKey) {
  if (Array.isArray(values) && values.length) lines.push(`## ${title}`, "", ...values.map((item) => `- **${item[primaryKey]}**${item[secondaryKey] ? `: ${item[secondaryKey]}` : ""}`), "");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function saveHistory(entry) {
  const history = await readHistory();
  const next = pruneHistory([entry, ...history.filter((item) => item?.id !== entry.id)]).slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
  renderHistory(next);
}

async function readHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const clean = pruneHistory(history);
  if (clean.length !== history.length) await chrome.storage.local.set({ [HISTORY_KEY]: clean });
  return clean;
}

function pruneHistory(history) {
  const retentionDays = Number(retentionControl.value || 30);
  const valid = history.filter((item) => item && typeof item.id === "string" && typeof item.summary === "string");
  if (retentionDays === 0) return valid.slice(0, MAX_HISTORY);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return valid.filter((item) => {
    const created = Date.parse(item.createdAt);
    return Number.isFinite(created) && created >= cutoff;
  }).slice(0, MAX_HISTORY);
}

function renderHistory(history) {
  const filtered = searchHistory(history, historySearchControl.value);
  historyList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = historySearchControl.value.trim()
      ? "No saved summaries match that search."
      : "No saved summaries yet. Turn on history before summarizing a post.";
    historyList.append(empty);
    return;
  }
  for (const item of filtered) {
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
    meta.textContent = `${formatDate(item.createdAt)} · ${item.provider || "AI"} / ${item.model || "configured model"}`;
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
  try {
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
        summaryModeControl.value = item.settings.summaryMode || "general";
        providerControl.value = item.settings.provider || "auto";
        modelPreferenceControl.value = item.settings.modelPreference || "auto";
        expertiseControl.value = item.settings.profile?.expertise || "auto";
        focusAreasControl.value = item.settings.profile?.focusAreas || "";
      }
      lastSummary = item.summary || "";
      lastSections = item.sections || null;
      lastResponse = item;
      currentResultId = item.id;
      renderSummary(lastSections, lastSummary);
      resultSection.hidden = !lastSummary;
      resultInfo.textContent = `Saved · ${formatDate(item.createdAt)}`;
      resultUsage.textContent = formatUsage(item.usage);
      await renderExistingFeedback(currentResultId);
      switchTab("summary");
      setStatus("Loaded a saved summary.", false, true);
    }
  } catch {
    setStatus("Could not update local history. Try again.", true);
  }
}

async function clearHistory() {
  if (!confirm("Delete all saved summaries from this device?")) return;
  try {
    await chrome.storage.local.remove(HISTORY_KEY);
    renderHistory([]);
    setStatus("Local history cleared.", false, true);
  } catch {
    setStatus("Could not clear local history.", true);
  }
}

async function savePreferences() {
  const prefs = {
    length: lengthControl.value,
    tone: toneControl.value,
    language: languageControl.value,
    summaryMode: summaryModeControl.value,
    provider: providerControl.value,
    modelPreference: modelPreferenceControl.value,
    expertise: expertiseControl.value,
    focusAreas: focusAreasControl.value.slice(0, 120),
    applyFeedback: applyFeedbackControl.checked,
    saveHistory: saveHistoryControl.checked,
    retentionDays: Number(retentionControl.value)
  };
  try {
    await chrome.storage.local.set({ [PREFS_KEY]: prefs });
    renderHistory(await readHistory());
    await loadFeedbackInsights();
  } catch {
    setStatus("Could not save preferences locally.", true);
  }
}

function switchTab(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== name;
    panel.classList.toggle("active", panel.dataset.panel === name);
  }
  if (name === "history") void readHistory().then(renderHistory).catch(() => setStatus("Could not load local history.", true));
  if (name === "usage") void loadUsage();
}

async function loadUsage() {
  const button = document.querySelector("#refreshUsageBtn");
  button.disabled = true;
  document.querySelector("#usageStatus").textContent = "Loading local AI metrics…";
  try {
    const response = await sendRuntimeMessage({ type: "GET_METRICS" });
    if (!response?.ok) throw new Error(response?.error || "Could not load metrics.");
    const m = response.metrics;
    const daily = m.daily || {};
    document.querySelector("#metricRequests").textContent = formatNumber(m.requests);
    document.querySelector("#metricCalls").textContent = formatNumber(daily.modelCalls ?? m.modelCalls);
    document.querySelector("#metricDailyLimit").textContent = daily.limit > 0
      ? `${formatNumber(daily.remaining)} calls left · resets at 00:00 UTC`
      : "No daily limit configured";
    document.querySelector("#metricCache").textContent = formatNumber(m.hits);
    document.querySelector("#metricTokens").textContent = formatNumber(daily.totalTokens ?? m.totalTokens);
    const dailyCost = m.costEstimateConfigured ? Number(daily.estimatedCostUsd || 0) : null;
    document.querySelector("#metricCost").textContent = dailyCost == null
      ? (m.costEstimateIncomplete ? "Incomplete" : "Not configured")
      : `$${dailyCost.toFixed(6)}`;
    document.querySelector("#metricCostNote").textContent = m.costEstimateConfigured
      ? "All today's successful calls have provider rates configured; check your provider billing page for exact charges."
      : m.costEstimateIncomplete
        ? "Some calls lack token rates or usage data. Configure rates for every provider you use to get a complete estimate."
        : "Set provider-specific input/output token rates in server/.env to estimate usage.";
    const denominator = Number(m.hits || 0) + Number(m.misses || 0) + Number(m.coalesced || 0);
    const hitRate = denominator ? (Number(m.hits || 0) / denominator * 100).toFixed(1) : "0.0";
    document.querySelector("#metricCacheRate").textContent = `Cache hit rate: ${hitRate}%`;
    document.querySelector("#metricModel").textContent = `Model: ${m.provider ? `${m.provider} / ` : ""}${m.model || "—"}`;
    document.querySelector("#metricEntries").textContent = `Cached summaries: ${formatNumber(m.cacheEntries)}`;
    const limitText = daily.limitReached
      ? "Daily model-call limit reached"
      : Number(daily.limit) === 0
        ? "No daily model-call cap"
        : Number.isFinite(Number(daily.remaining))
          ? `${formatNumber(daily.remaining)} calls remaining today`
          : "Daily cap unavailable";
    document.querySelector("#usageStatus").textContent = `UTC day ${daily.date || "—"} · ${formatNumber(m.errors)} errors · ${limitText}`;
  } catch (error) {
    document.querySelector("#usageStatus").textContent = error?.message || "Could not load metrics. Is the local server running?";
    for (const id of ["metricRequests", "metricCalls", "metricCache", "metricTokens", "metricCost", "metricDailyLimit"]) document.querySelector(`#${id}`).textContent = "—";
  } finally {
    button.disabled = false;
  }
}

async function handleFeedbackClick(event) {
  const button = event.target.closest("button[data-rating]");
  if (!button || !currentResultId) return;
  try {
    const stored = await chrome.storage.local.get(FEEDBACK_KEY);
    const entries = Array.isArray(stored[FEEDBACK_KEY]) ? stored[FEEDBACK_KEY] : [];
    if (entries.some((entry) => entry.resultId === currentResultId)) return renderFeedbackState("Thanks — feedback already saved on this device.");
    const next = [{ id: createId(), resultId: currentResultId, rating: button.dataset.rating,
      reason: document.querySelector("#feedbackReason").value, createdAt: new Date().toISOString() }, ...entries].slice(0, MAX_FEEDBACK);
    await chrome.storage.local.set({ [FEEDBACK_KEY]: next });
    renderFeedbackState("Thanks — saved only on this device.");
    await loadFeedbackInsights();
  } catch {
    document.querySelector("#feedbackStatus").textContent = "Could not save feedback locally.";
  }
}

function resetFeedbackState() {
  for (const button of document.querySelectorAll(".feedback-button")) button.disabled = false;
  document.querySelector("#feedbackReason").value = "";
  document.querySelector("#feedbackStatus").textContent = "Feedback stays on this device.";
  void renderExistingFeedback(currentResultId);
}

async function renderExistingFeedback(resultId) {
  const stored = await chrome.storage.local.get(FEEDBACK_KEY);
  const entries = Array.isArray(stored[FEEDBACK_KEY]) ? stored[FEEDBACK_KEY] : [];
  if (entries.some((entry) => entry.resultId === resultId)) {
    renderFeedbackState("Thanks — feedback already saved on this device.");
  } else {
    for (const button of document.querySelectorAll(".feedback-button")) button.disabled = false;
    document.querySelector("#feedbackStatus").textContent = "Feedback stays on this device.";
  }
}

function renderFeedbackState(message) {
  for (const button of document.querySelectorAll(".feedback-button")) button.disabled = true;
  document.querySelector("#feedbackStatus").textContent = message;
}

async function exportLocalData() {
  if (!confirm("This export contains saved source post text, summaries, and preferences. Keep the file private. Continue?")) return;
  try {
    const stored = await chrome.storage.local.get([HISTORY_KEY, PREFS_KEY, FEEDBACK_KEY]);
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      product: "LinkedIn TL;DR",
      history: Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [],
      preferences: stored[PREFS_KEY] || {},
      feedback: Array.isArray(stored[FEEDBACK_KEY]) ? stored[FEEDBACK_KEY] : []
    };
    downloadFile(`${JSON.stringify(exportPayload, null, 2)}\n`, `linkedin-tldr-data-${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8");
    setStatus("Your local data export is ready.", false, true);
  } catch {
    setStatus("Could not export local data.", true);
  }
}

async function clearAllLocalData() {
  if (!confirm("Delete all saved history, feedback, preferences, and this privacy confirmation from this Chrome profile? This cannot be undone.")) return;
  try {
    await chrome.storage.local.clear();
    input.value = "";
    lastSummary = "";
    lastSections = null;
    lastResponse = null;
    currentResultId = "";
    resultSection.hidden = true;
    consentAccepted = false;
    consentCheck.checked = false;
    saveHistoryControl.checked = false;
    lengthControl.value = "standard";
    toneControl.value = "neutral";
    languageControl.value = "auto";
    summaryModeControl.value = "general";
    providerControl.value = "auto";
    modelPreferenceControl.value = "auto";
    expertiseControl.value = "auto";
    focusAreasControl.value = "";
    applyFeedbackControl.checked = false;
    document.querySelector("#feedbackReason").value = "";
    retentionControl.value = "30";
    updateCount();
    renderHistory([]);
    updateConsentUI();
    switchTab("summary");
    setStatus("All local extension data was deleted.", false, true);
  } catch {
    setStatus("Could not delete all local data. Try again.", true);
  }
}

async function loadCapabilities() {
  const previous = providerControl.value;
  try {
    const response = await sendRuntimeMessage({ type: "GET_CAPABILITIES" });
    if (!response?.ok) throw new Error(response?.error || "Could not read AI provider settings.");
    const providers = Array.isArray(response.capabilities?.providers) ? response.capabilities.providers : [];
    providerControl.replaceChildren();
    addProviderOption("auto", "Auto (recommended)");
    for (const item of providers) addProviderOption(item.id, `${item.label} · ${item.model}`);
    if (previous === "auto" || providers.some((item) => item.id === previous)) providerControl.value = previous;
    else providerControl.value = response.capabilities?.defaultProvider || "auto";
    if (!providers.length) setStatus("No AI provider is configured. Add a provider key to server/.env.", true);
  } catch {
    // Keep a usable static fallback if the local server is stopped during popup startup.
    providerControl.replaceChildren();
    addProviderOption("auto", "Auto (start local backend)");
    addProviderOption("gemini", "Google Gemini (check server/.env)");
    addProviderOption("openai", "OpenAI (check server/.env)");
    addProviderOption("anthropic", "Anthropic (check server/.env)");
    providerControl.value = previous || "auto";
  }
}

function addProviderOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  providerControl.append(option);
}

async function getFeedbackGuidance() {
  const stored = await chrome.storage.local.get(FEEDBACK_KEY);
  const entries = Array.isArray(stored[FEEDBACK_KEY]) ? stored[FEEDBACK_KEY] : [];
  const counts = new Map();
  for (const entry of entries) {
    if (entry?.rating !== "not-useful" || !entry.reason) continue;
    counts.set(entry.reason, (counts.get(entry.reason) || 0) + 1);
  }
  const guidance = {
    "too-vague": "Be more specific and make the important details explicit.",
    "missed-tech": "Preserve technical details, terminology, architecture, and trade-offs present in the post.",
    "too-long": "Be concise and remove redundant detail.",
    inaccurate: "Be strict about source fidelity; omit uncertain information rather than infer."
  };
  const [reason, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return reason && count >= 2 ? guidance[reason] || "" : "";
}

async function loadFeedbackInsights() {
  const stored = await chrome.storage.local.get(FEEDBACK_KEY);
  const entries = Array.isArray(stored[FEEDBACK_KEY]) ? stored[FEEDBACK_KEY] : [];
  const useful = entries.filter((entry) => entry.rating === "useful").length;
  const notUseful = entries.filter((entry) => entry.rating === "not-useful").length;
  const guidance = await getFeedbackGuidance();
  const text = `Saved locally: ${useful} useful · ${notUseful} not useful. ${guidance ? "A repeated improvement preference is ready to apply." : "More consistent feedback is needed before suggesting an adaptation."}`;
  const target = document.querySelector("#feedbackInsights");
  if (target) target.textContent = text;
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
