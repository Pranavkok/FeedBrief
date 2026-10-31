import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const validSections = { tldr: "The post shares a product update.", keyTakeaways: ["A new feature shipped."], whyItMatters: "It may affect users of the product." };

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

function fakeGenerator(counter = { calls: 0 }) {
  return async () => {
    counter.calls++;
    return {
      text: JSON.stringify(validSections),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
    };
  };
}

test("summarizes, caches duplicates, and reports token/cost metrics", async () => {
  const counter = { calls: 0 };
  const app = createApp({
    extensionId,
    usageFilePath: null,
    generateSummary: fakeGenerator(counter),
    inputRate: 1,
    outputRate: 2
  });
  await withServer(app, async (base) => {
    const headers = { "Content-Type": "application/json", Origin: `chrome-extension://${extensionId}` };
    const payload = { text: "A product update", length: "standard", tone: "neutral", language: "auto" };
    const first = await fetch(`${base}/api/summarize`, { method: "POST", headers, body: JSON.stringify(payload) });
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-cache"), "MISS");
    assert.equal(firstBody.usage.totalTokens, 150);
    assert.match(firstBody.summary, /TL;DR/);

    const second = await fetch(`${base}/api/summarize`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(second.headers.get("x-cache"), "HIT");
    const secondBody = await second.json();
    assert.equal(secondBody.usage.totalTokens, 0, "a cache hit must not claim fresh token usage");
    assert.equal(counter.calls, 1);

    const metricsResponse = await fetch(`${base}/metrics`, { headers: { Origin: `chrome-extension://${extensionId}` } });
    const metrics = await metricsResponse.json();
    assert.equal(metrics.requests, 2);
    assert.equal(metrics.modelCalls, 1);
    assert.equal(metrics.hits, 1);
    assert.equal(metrics.totalTokens, 150);
    assert.equal(metrics.costEstimateConfigured, true);
    assert.equal(metrics.estimatedCostUsd, 0.0002);
  });
});

test("separates cache entries when language or settings change", async () => {
  const counter = { calls: 0 };
  const app = createApp({ extensionId, usageFilePath: null, generateSummary: fakeGenerator(counter) });
  await withServer(app, async (base) => {
    const headers = { "Content-Type": "application/json", Origin: `chrome-extension://${extensionId}` };
    for (const language of ["auto", "hi"]) {
      const response = await fetch(`${base}/api/summarize`, {
        method: "POST", headers,
        body: JSON.stringify({ text: "Same source", language })
      });
      assert.equal(response.status, 200);
    }
    assert.equal(counter.calls, 2);
  });
});

test("rejects unrelated origins and invalid requests", async () => {
  const app = createApp({ extensionId, usageFilePath: null, generateSummary: fakeGenerator() });
  await withServer(app, async (base) => {
    const blocked = await fetch(`${base}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ text: "hello" })
    });
    assert.equal(blocked.status, 403);

    const invalid = await fetch(`${base}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `chrome-extension://${extensionId}` },
      body: JSON.stringify({ text: "", language: "xx" })
    });
    assert.equal(invalid.status, 400);
  });
});

test("returns a timeout response and records the failure", async () => {
  const app = createApp({
    extensionId,
    usageFilePath: null,
    generateSummary: async () => { const error = new Error("timed out"); error.name = "AbortError"; throw error; }
  });
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: `chrome-extension://${extensionId}` },
      body: JSON.stringify({ text: "timeout test" })
    });
    assert.equal(response.status, 504);
    assert.match((await response.json()).error, /timed out/i);
    const metrics = await (await fetch(`${base}/metrics`)).json();
    assert.equal(metrics.errors, 1);
    assert.equal(metrics.modelCalls, 1);
  });
});

test("enforces daily model-call limit while allowing cached responses", async () => {
  const counter = { calls: 0 };
  const app = createApp({
    extensionId,
    usageFilePath: null,
    dailyModelCallLimit: 1,
    generateSummary: fakeGenerator(counter)
  });
  await withServer(app, async (base) => {
    const headers = { "Content-Type": "application/json", Origin: `chrome-extension://${extensionId}` };
    const payload = { text: "cached even after daily cap", length: "standard", tone: "neutral", language: "auto" };
    const first = await fetch(`${base}/api/summarize`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(first.status, 200);
    const cacheHit = await fetch(`${base}/api/summarize`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(cacheHit.status, 200);
    const blocked = await fetch(`${base}/api/summarize`, {
      method: "POST", headers,
      body: JSON.stringify({ ...payload, text: "a different post must be blocked" })
    });
    assert.equal(blocked.status, 429);
    assert.match((await blocked.json()).error, /daily AI model-call limit/i);
    assert.equal(counter.calls, 1);
  });
});
