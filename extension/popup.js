const MAX_CHARS = 20_000;

const input = document.querySelector("#postText");
const count = document.querySelector("#charCount");
const submit = document.querySelector("#summarizeBtn");
const status = document.querySelector("#status");
const resultSection = document.querySelector("#resultSection");
const result = document.querySelector("#result");
const copy = document.querySelector("#copyBtn");

input.addEventListener("input", () => {
  count.textContent = `${input.value.length.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
});

submit.addEventListener("click", async () => {
  const text = input.value.trim();
  resultSection.hidden = true;
  status.className = "status";

  if (!text) {
    status.textContent = "Paste some post text first.";
    status.classList.add("error");
    return;
  }
  if (text.length > MAX_CHARS) {
    status.textContent = "Text is too long.";
    status.classList.add("error");
    return;
  }

  submit.disabled = true;
  submit.textContent = "Summarizing…";
  status.textContent = "Sending your submitted text to the local backend…";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_TEXT",
      payload: { text }
    });

    if (!response?.ok) throw new Error(response?.error || "Summarization failed.");
    result.textContent = response.summary;
    resultSection.hidden = false;
    status.textContent = "Done.";
  } catch (error) {
    status.textContent = error.message || "Something went wrong.";
    status.classList.add("error");
  } finally {
    submit.disabled = false;
    submit.textContent = "Summarize";
  }
});

copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(result.textContent);
  copy.textContent = "Copied";
  setTimeout(() => { copy.textContent = "Copy"; }, 1200);
});
