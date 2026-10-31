import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_FILE = fileURLToPath(new URL("../data/daily-usage.json", import.meta.url));

/** Stores aggregate API usage only. No prompt, post text, or summary is written. */
export function createDailyUsageStore({
  filePath = DEFAULT_FILE,
  limit = 50,
  now = () => new Date()
} = {}) {
  let state;
  let queue = Promise.resolve();

  function utcDate() {
    return now().toISOString().slice(0, 10);
  }

  async function ensureLoaded() {
    if (state) return rotateIfNeeded();
    if (!filePath) {
      state = freshState();
      return;
    }
    try {
      state = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.name !== "SyntaxError") throw error;
      state = freshState();
    }
    if (state && typeof state === "object" && state.unpricedCalls === undefined && Number.isSafeInteger(state.modelCalls)) {
      // Older V6/V7 state did not track pricing coverage; treat prior calls as unpriced.
      state.unpricedCalls = state.modelCalls;
    }
    if (!isValidState(state)) state = freshState();
    await rotateIfNeeded();
  }

  function freshState() {
    return { date: utcDate(), modelCalls: 0, unpricedCalls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
  }

  function isValidState(value) {
    return value && typeof value === "object" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
      && ["modelCalls", "unpricedCalls", "promptTokens", "outputTokens", "totalTokens"].every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0)
      && Number.isFinite(value.estimatedCostUsd) && value.estimatedCostUsd >= 0;
  }

  async function rotateIfNeeded() {
    if (state.date !== utcDate()) {
      state = freshState();
      await persist();
    }
  }

  async function persist() {
    if (!filePath) return;
    await mkdir(dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, filePath);
  }

  function serialize(operation) {
    const task = queue.then(operation, operation);
    queue = task.catch(() => {});
    return task;
  }

  async function reserveModelCall() {
    return serialize(async () => {
      await ensureLoaded();
      if (limit > 0 && state.modelCalls >= limit) {
        return { allowed: false, limit, used: state.modelCalls, remaining: 0, date: state.date };
      }
      state.modelCalls += 1;
      await persist();
      return { allowed: true, limit, used: state.modelCalls, remaining: limit > 0 ? Math.max(0, limit - state.modelCalls) : null, date: state.date };
    });
  }

  async function recordTokens(usage, estimatedCostUsd = 0, costConfigured = false) {
    return serialize(async () => {
      await ensureLoaded();
      state.promptTokens += safeInt(usage?.promptTokens);
      state.outputTokens += safeInt(usage?.outputTokens);
      state.totalTokens += safeInt(usage?.totalTokens);
      if (Number.isFinite(estimatedCostUsd) && estimatedCostUsd >= 0) state.estimatedCostUsd += estimatedCostUsd;
      if (!costConfigured) state.unpricedCalls += 1;
      await persist();
      return snapshotUnsafe();
    });
  }

  async function recordUnpricedCall() {
    return serialize(async () => {
      await ensureLoaded();
      state.unpricedCalls += 1;
      await persist();
      return snapshotUnsafe();
    });
  }

  function snapshotUnsafe() {
    return {
      ...state,
      limit,
      remaining: limit > 0 ? Math.max(0, limit - state.modelCalls) : null,
      limitReached: limit > 0 && state.modelCalls >= limit
    };
  }

  async function snapshot() {
    return serialize(async () => {
      await ensureLoaded();
      return snapshotUnsafe();
    });
  }

  return { reserveModelCall, recordTokens, recordUnpricedCall, snapshot };
}

function safeInt(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}
