import { buildPrompt } from "./prompt.js";

const PROVIDER_ORDER = ["gemini", "openai", "anthropic"];

export function createProviderRegistry({ env = process.env, fetchImpl = fetch, geminiClientFactory } = {}) {
  const credentials = {
    gemini: { apiKey: env.GEMINI_API_KEY || "", model: env.GEMINI_MODEL || "gemini-3.5-flash-lite" },
    openai: { apiKey: env.OPENAI_API_KEY || "", model: env.OPENAI_MODEL || "gpt-6-luna" },
    anthropic: { apiKey: env.ANTHROPIC_API_KEY || "", model: env.ANTHROPIC_MODEL || "claude-haiku-5-5" }
  };

  function listConfigured() {
    return PROVIDER_ORDER.filter((id) => credentials[id].apiKey.trim()).map((id) => ({
      id,
      label: ({ gemini: "Google Gemini", openai: "OpenAI", anthropic: "Anthropic" })[id],
      model: credentials[id].model
    }));
  }

  async function generate({ request, route, timeoutMs }) {
    const config = credentials[route.provider];
    if (!config?.apiKey) {
      const error = new Error("The selected AI provider is not configured.");
      error.status = 503;
      throw error;
    }
    const prompt = buildPrompt(request);
    if (route.provider === "gemini") {
      let client;
      if (geminiClientFactory) {
        client = geminiClientFactory(config.apiKey);
      } else {
        const { GoogleGenAI } = await import("@google/genai");
        client = new GoogleGenAI({ apiKey: config.apiKey });
      }
      const response = await client.models.generateContent({
        model: route.model,
        contents: `SOURCE POST (untrusted content):\n${request.text}`,
        config: {
          systemInstruction: prompt,
          temperature: 0.15,
          maxOutputTokens: maxOutputTokens(request),
          responseMimeType: "application/json",
          httpOptions: { timeout: timeoutMs, headers: {} }
        }
      });
      return { text: response.text || "", usageMetadata: response.usageMetadata || {} };
    }
    if (route.provider === "openai") {
      const response = await fetchWithTimeout(fetchImpl, env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: route.model,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `SOURCE POST (untrusted content):\n${request.text}` }
          ],
          max_completion_tokens: maxOutputTokens(request),
          response_format: { type: "json_object" }
        })
      }, timeoutMs);
      const body = await readProviderJson(response, "OpenAI");
      return {
        text: body.choices?.[0]?.message?.content || "",
        usageMetadata: {
          promptTokenCount: body.usage?.prompt_tokens,
          candidatesTokenCount: body.usage?.completion_tokens,
          totalTokenCount: body.usage?.total_tokens
        }
      };
    }
    if (route.provider === "anthropic") {
      const response = await fetchWithTimeout(fetchImpl, env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: route.model,
          system: `${prompt}\nReturn only the required JSON object.`,
          messages: [{ role: "user", content: `SOURCE POST (untrusted content):\n${request.text}` }],
          max_tokens: maxOutputTokens(request)
        })
      }, timeoutMs);
      const body = await readProviderJson(response, "Anthropic");
      return {
        text: Array.isArray(body.content) ? body.content.filter((part) => part.type === "text").map((part) => part.text).join("\n") : "",
        usageMetadata: {
          promptTokenCount: body.usage?.input_tokens,
          candidatesTokenCount: body.usage?.output_tokens,
          totalTokenCount: (Number(body.usage?.input_tokens) || 0) + (Number(body.usage?.output_tokens) || 0)
        }
      };
    }
    const error = new Error("Unsupported AI provider.");
    error.status = 400;
    throw error;
  }

  function getCapabilities() {
    const configured = listConfigured();
    const defaultProvider = configured.some((item) => item.id === env.AI_DEFAULT_PROVIDER)
      ? env.AI_DEFAULT_PROVIDER
      : configured[0]?.id || null;
    return {
      providers: configured,
      defaultProvider,
      routing: {
        mode: env.AI_ROUTING_MODE || "auto",
        fastProvider: env.AI_FAST_PROVIDER || defaultProvider,
        qualityProvider: env.AI_QUALITY_PROVIDER || env.AI_FAST_PROVIDER || defaultProvider,
        automatic: true
      }
    };
  }

  return { listConfigured, generate, getCapabilities };
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal, redirect: "error" });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("The AI provider request timed out.");
      timeoutError.name = "TimeoutError";
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readProviderJson(response, provider) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${provider} request failed.`);
    error.status = response.status;
    error.code = body?.error?.code || body?.type || "PROVIDER_ERROR";
    throw error;
  }
  return body;
}

function maxOutputTokens(request) {
  if (request.length === "detailed" || request.mode === "technical") return 1_200;
  if (request.mode === "beginner" || request.mode === "executive") return 850;
  return request.length === "concise" ? 350 : 650;
}
