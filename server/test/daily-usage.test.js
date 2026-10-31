import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDailyUsageStore } from "../src/daily-usage.js";

test("enforces and persists a daily model-call limit without storing content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tldr-usage-"));
  const filePath = join(directory, "usage.json");
  try {
    const store = createDailyUsageStore({ filePath, limit: 2 });
    assert.equal((await store.reserveModelCall()).allowed, true);
    await store.recordTokens({ promptTokens: 100, outputTokens: 50, totalTokens: 150 }, 0.0002);
    assert.equal((await store.reserveModelCall()).allowed, true);
    const blocked = await store.reserveModelCall();
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.used, 2);

    const freshInstance = createDailyUsageStore({ filePath, limit: 2 });
    const state = await freshInstance.snapshot();
    assert.equal(state.modelCalls, 2);
    assert.equal(state.totalTokens, 150);
    assert.equal(state.estimatedCostUsd, 0.0002);
    const onDisk = await readFile(filePath, "utf8");
    assert.doesNotMatch(onDisk, /post text|summary content|prompt body/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("resets the persisted daily counter at the next UTC date", async () => {
  let now = new Date("2026-10-31T23:59:00.000Z");
  const store = createDailyUsageStore({ filePath: null, limit: 1, now: () => now });
  await store.reserveModelCall();
  assert.equal((await store.snapshot()).limitReached, true);
  now = new Date("2026-11-01T00:00:00.000Z");
  const state = await store.snapshot();
  assert.equal(state.date, "2026-11-01");
  assert.equal(state.modelCalls, 0);
  assert.equal(state.limitReached, false);
});
