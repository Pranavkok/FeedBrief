import { createHash } from "node:crypto";

export function createSummaryCache({ ttlMs = 30 * 60_000, maxEntries = 200, now = Date.now } = {}) {
  const entries = new Map();
  const inFlight = new Map();
  const stats = { hits: 0, misses: 0, coalesced: 0, modelCalls: 0, errors: 0 };
  function makeKey(parts) { return createHash("sha256").update(JSON.stringify(parts)).digest("hex"); }
  function get(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) { entries.delete(key); return null; }
    entries.delete(key); entries.set(key, entry);
    return entry.value;
  }
  function set(key, value) {
    entries.delete(key); entries.set(key, { value, expiresAt: now() + ttlMs });
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }
  async function getOrCreate(key, factory) {
    const cached = get(key);
    if (cached) { stats.hits++; return { value: cached, cache: "HIT" }; }
    if (inFlight.has(key)) { stats.coalesced++; return { value: await inFlight.get(key), cache: "COALESCED" }; }
    stats.misses++;
    const promise = (async () => {
      stats.modelCalls++;
      try { const value = await factory(); set(key, value); return value; }
      catch (error) { stats.errors++; throw error; }
      finally { inFlight.delete(key); }
    })();
    inFlight.set(key, promise);
    return { value: await promise, cache: "MISS" };
  }
  return { makeKey, getOrCreate, stats, size: () => entries.size, clear: () => entries.clear() };
}
