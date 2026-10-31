import test from "node:test";
import assert from "node:assert/strict";
import { createSummaryCache } from "../src/cache.js";

test("serves cached results for a repeated key", async () => {
  const cache = createSummaryCache();
  let calls = 0;
  const factory = async () => ({ value: ++calls });
  const first = await cache.getOrCreate("same", factory);
  const second = await cache.getOrCreate("same", factory);
  assert.equal(first.cache, "MISS");
  assert.equal(second.cache, "HIT");
  assert.deepEqual(second.value, { value: 1 });
  assert.equal(cache.stats.modelCalls, 1);
});

test("coalesces concurrent identical requests", async () => {
  const cache = createSummaryCache();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const factory = async () => { calls++; await gate; return "one"; };
  const first = cache.getOrCreate("same", factory);
  const second = cache.getOrCreate("same", factory);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a.value, "one");
  assert.equal(b.value, "one");
  assert.equal(b.cache, "COALESCED");
});

test("expires entries and evicts least-recently-used entries", async () => {
  let now = 0;
  const cache = createSummaryCache({ ttlMs: 10, maxEntries: 2, now: () => now });
  await cache.getOrCreate("a", async () => 1);
  await cache.getOrCreate("b", async () => 2);
  await cache.getOrCreate("a", async () => 9);
  await cache.getOrCreate("c", async () => 3);
  assert.equal(cache.size(), 2);
  assert.equal((await cache.getOrCreate("b", async () => 8)).cache, "MISS");
  now = 20;
  assert.equal((await cache.getOrCreate("a", async () => 7)).cache, "MISS");
});

test("does not cache failures", async () => {
  const cache = createSummaryCache();
  await assert.rejects(cache.getOrCreate("failed", async () => { throw new Error("no"); }));
  assert.equal((await cache.getOrCreate("failed", async () => "ok")).cache, "MISS");
});
