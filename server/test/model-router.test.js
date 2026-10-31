import test from "node:test";
import assert from "node:assert/strict";
import { resolveModelRoute } from "../src/model-router.js";

const registry = {
  listConfigured: () => [
    { id: "gemini", model: "gemini-fast" },
    { id: "openai", model: "gpt-fast" }
  ]
};

test("auto routing selects fast for short general summaries", () => {
  const route = resolveModelRoute({ text: "short post", mode: "general", length: "standard", modelPreference: "auto", provider: "auto", profile: {} }, registry, {
    AI_FAST_PROVIDER: "gemini", AI_FAST_MODEL: "gemini-fast", AI_QUALITY_PROVIDER: "openai", AI_QUALITY_MODEL: "gpt-quality"
  });
  assert.deepEqual(route, { provider: "gemini", model: "gemini-fast", routeKind: "fast" });
});

test("auto routing selects quality for technical posts", () => {
  const route = resolveModelRoute({ text: "short post", mode: "technical", length: "standard", modelPreference: "auto", provider: "auto", profile: {} }, registry, {
    AI_FAST_PROVIDER: "gemini", AI_QUALITY_PROVIDER: "openai", AI_QUALITY_MODEL: "gpt-quality"
  });
  assert.deepEqual(route, { provider: "openai", model: "gpt-quality", routeKind: "quality" });
});

test("explicit provider selection is restricted to configured providers", () => {
  const route = resolveModelRoute({ text: "post", mode: "general", length: "standard", modelPreference: "fast", provider: "openai", profile: {} }, registry, {});
  assert.equal(route.provider, "openai");
  assert.throws(() => resolveModelRoute({ text: "post", provider: "anthropic", modelPreference: "auto", profile: {} }, registry, {}), /not configured/i);
});

test("routing fails clearly when no provider is configured", () => {
  assert.throws(() => resolveModelRoute({ text: "post", provider: "auto", modelPreference: "auto", profile: {} }, { listConfigured: () => [] }, {}), /no ai provider/i);
});
