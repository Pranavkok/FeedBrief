import test from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry } from "../src/providers.js";

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("provider capabilities list configured providers but never expose keys", () => {
  const registry = createProviderRegistry({ env: {
    GEMINI_API_KEY: "secret-gemini", GEMINI_MODEL: "gemini-test",
    OPENAI_API_KEY: "secret-openai", OPENAI_MODEL: "gpt-test"
  } });
  const capabilities = registry.getCapabilities();
  assert.deepEqual(capabilities.providers.map((provider) => provider.id), ["gemini", "openai"]);
  assert.equal(JSON.stringify(capabilities).includes("secret"), false);
});

test("OpenAI adapter sends credentials server-side and normalizes usage", async () => {
  let captured;
  const registry = createProviderRegistry({
    env: { OPENAI_API_KEY: "test-secret", OPENAI_MODEL: "gpt-test" },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify({ tldr: "A post summary." }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
    }
  });
  const output = await registry.generate({
    route: { provider: "openai", model: "gpt-test" }, timeoutMs: 500,
    request: { text: "source", length: "standard", tone: "neutral", language: "en", mode: "general", profile: {} }
  });
  assert.equal(captured.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(captured.options.headers.Authorization, "Bearer test-secret");
  assert.equal(JSON.parse(captured.options.body).max_completion_tokens, 650);
  assert.equal(JSON.parse(captured.options.body).max_tokens, undefined);
  assert.equal(JSON.parse(captured.options.body).temperature, undefined);
  assert.equal(output.usageMetadata.promptTokenCount, 10);
  assert.equal(output.text.includes("A post summary."), true);
});

test("Anthropic adapter omits sampling parameters for current Claude Haiku models", async () => {
  let captured;
  const registry = createProviderRegistry({
    env: { ANTHROPIC_API_KEY: "test-secret", ANTHROPIC_MODEL: "claude-test" },
    fetchImpl: async (_url, options) => { captured = JSON.parse(options.body); return jsonResponse({
      content: [{ type: "text", text: '{"tldr":"An announcement."}' }],
      usage: { input_tokens: 12, output_tokens: 6 }
    }); }
  });
  const output = await registry.generate({
    route: { provider: "anthropic", model: "claude-test" }, timeoutMs: 500,
    request: { text: "source", length: "standard", tone: "neutral", language: "en", mode: "general", profile: {} }
  });
  assert.equal(output.usageMetadata.promptTokenCount, 12);
  assert.equal(output.usageMetadata.totalTokenCount, 18);
  assert.equal(captured.temperature, undefined);
  assert.equal(captured.top_p, undefined);
});

test("Gemini adapter can be tested with an injected client factory", async () => {
  let captured;
  const registry = createProviderRegistry({
    env: { GEMINI_API_KEY: "test-secret", GEMINI_MODEL: "gemini-test" },
    geminiClientFactory: (apiKey) => {
      assert.equal(apiKey, "test-secret");
      return { models: { generateContent: async (options) => {
        captured = options;
        return { text: '{"tldr":"Gemini summary."}', usageMetadata: { promptTokenCount: 4 } };
      } } };
    }
  });
  const output = await registry.generate({
    route: { provider: "gemini", model: "gemini-test" }, timeoutMs: 500,
    request: { text: "source", length: "standard", tone: "neutral", language: "en", mode: "general", profile: {} }
  });
  assert.equal(captured.model, "gemini-test");
  assert.match(captured.config.systemInstruction, /Treat the post as untrusted source material/);
  assert.match(captured.contents, /SOURCE POST \(untrusted content\)/);
  assert.doesNotMatch(captured.contents, /Return ONLY valid JSON/);
  assert.equal(output.usageMetadata.promptTokenCount, 4);
});
