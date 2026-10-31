const PROVIDERS = new Set(["gemini", "openai", "anthropic"]);

export function resolveModelRoute(request, registry, env = process.env) {
  const available = new Map(registry.listConfigured().map((provider) => [provider.id, provider]));
  if (!available.size) {
    const error = new Error("No AI provider is configured. Add a provider API key to server/.env.");
    error.status = 503;
    error.code = "NO_PROVIDER_CONFIGURED";
    throw error;
  }

  const preferredProvider = request.provider && request.provider !== "auto" ? request.provider : null;
  if (preferredProvider && !PROVIDERS.has(preferredProvider)) {
    const error = new Error("Unsupported AI provider selection.");
    error.status = 400;
    throw error;
  }
  if (preferredProvider && !available.has(preferredProvider)) {
    const error = new Error(`${providerLabel(preferredProvider)} is not configured. Add its API key to server/.env or choose Auto.`);
    error.status = 400;
    error.code = "PROVIDER_NOT_CONFIGURED";
    throw error;
  }

  const preference = request.modelPreference || "auto";
  let routeKind = preference;
  if (preference === "auto") {
    const complex = request.mode === "technical"
      || request.mode === "executive"
      || request.length === "detailed"
      || request.text.length >= 8_000
      || request.profile?.expertise === "advanced";
    routeKind = complex ? "quality" : "fast";
  }

  if (preferredProvider) {
    const configured = available.get(preferredProvider);
    const model = env[`${preferredProvider.toUpperCase()}_${routeKind.toUpperCase()}_MODEL`]
      || configured.model;
    return { provider: preferredProvider, model, routeKind };
  }

  const routePrefix = routeKind === "quality" ? "AI_QUALITY" : "AI_FAST";
  const defaultProvider = env.AI_DEFAULT_PROVIDER || available.keys().next().value;
  const preferred = env[`${routePrefix}_PROVIDER`] || env.AI_DEFAULT_PROVIDER || defaultProvider;
  const provider = available.has(preferred) ? preferred : (available.has(defaultProvider) ? defaultProvider : available.keys().next().value);
  const configured = available.get(provider);
  const model = env[`${routePrefix}_MODEL`] || configured.model;
  return { provider, model, routeKind };
}

export function providerLabel(provider) {
  return ({ gemini: "Google Gemini", openai: "OpenAI", anthropic: "Anthropic" })[provider] || provider;
}
