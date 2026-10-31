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
    await store.recordTokens({ promptTokens: 100, outputTokens: 50, totalTokens: 150 }, 0.0002, true);
    assert.equal((await store.reserveModelCall()).allowed, true);
    const blocked = await store.reserveModelCall();
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.used, 2);

    const freshInstance = createDailyUsageStore({ filePath, limit: 2 });
    const state = await freshInstance.snapshot();
    assert.equal(state.modelCalls, 2);
    assert.equal(state.totalTokens, 150);
    assert.equal(state.estimatedCostUsd, 0.0002);
    assert.equal(state.unpricedCalls, 0);
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


test("tracks calls without pricing rates as an incomplete estimate", async () => {
  const store = createDailyUsageStore({ filePath: null, limit: 5 });
  await store.reserveModelCall();
  await store.recordTokens({ promptTokens: 10, outputTokens: 5, totalTokens: 15 }, 0, false);
  await store.reserveModelCall();
  await store.recordUnpricedCall();
  const snapshot = await store.snapshot();
  assert.equal(snapshot.modelCalls, 2);
  assert.equal(snapshot.unpricedCalls, 2);
});

test("marks legacy usage calls as unpriced until rates are configured", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tldr-legacy-usage-"));
  const filePath = join(directory, "usage.json");
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, JSON.stringify({
      date: new Date().toISOString().slice(0, 10), modelCalls: 3,
      promptTokens: 20, outputTokens: 10, totalTokens: 30, estimatedCostUsd: 0
    }));
    const store = createDailyUsageStore({ filePath, limit: 10 });
    const snapshot = await store.snapshot();
    assert.equal(snapshot.modelCalls, 3);
    assert.equal(snapshot.unpricedCalls, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
