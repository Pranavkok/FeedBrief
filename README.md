# LinkedIn TL;DR — V9 (0.9.0)

A paste-first Chrome extension that summarizes text the user explicitly submits. V9 adds a local AI-provider layer, configurable model routing, personalized summary modes, structured extraction, local feedback adaptation, AI-enriched local search, and an evaluation harness. It keeps V7's local Node.js backend: no cloud infrastructure or account is required.

## V9 highlights

### AI provider layer

- Google Gemini is the default provider and uses the existing V7 `GEMINI_API_KEY` / `GEMINI_MODEL` configuration.
- Optional OpenAI and Anthropic adapters are included. They are disabled unless you add their API keys to `server/.env`.
- API keys stay in the local Node.js server. They are never sent to the Chrome extension.
- The extension's provider selector only lists providers whose key is configured.
- Model names and fast/quality routes are configured in `.env`; model availability depends on the API account and provider.

### Model routing

- `Auto` chooses the configured fast route for simpler requests and the quality route for longer/detailed/technical requests.
- `Fast / lower cost` and `Quality` let you override that decision.
- The route can be configured across providers, for example Gemini for fast requests and OpenAI for quality requests. Each provider/model still needs valid credentials and access.
- The router never silently changes provider after an API error. That avoids surprise cross-provider data sharing and unexpected billing.

### Personalized summary engine

- General, beginner explanation, technical deep-dive, and executive brief modes.
- Reader expertise and topic-focus preferences are saved in Chrome local storage.
- English, Hindi, Marathi, Hinglish, or source-language output.
- Extracts key concepts, author claims, source examples, caveats, and author-stated action items.
- The prompt instructs the model to treat pasted content as untrusted source material and avoid inventing claims or examples.

### Feedback adaptation

- Useful / not useful ratings and optional reasons remain local.
- When **Apply my local feedback** is enabled, repeated negative feedback reasons (at least twice) become short guidance instructions for future requests.
- Feedback is not automatically uploaded as telemetry. Only the derived guidance is included in a later provider request when the user enables the setting.

### AI-enriched local search

- Searches saved summary text, source text, and model-extracted concepts/claims using local relevance ranking.
- Search runs in the extension; query and saved history are not sent to any AI service.
- This is not vector-embedding search. It avoids extra API calls and cloud costs.

### Evaluation

- A small synthetic dataset covers technical posts, product announcements, and incidents.
- `npm run eval` sends the selected cases to the local backend and scores response structure and coverage of expected terms.
- The report contains case IDs, provider/model, scores, and term-coverage metadata only; it does not store source cases or model output text.
- The evaluation is a deterministic smoke rubric, not a substitute for human quality review or a model-as-judge evaluation.

## Architecture

```text
Chrome extension (Manifest V3)
  ├─ chrome.storage.local
  │    ├─ optional history and feedback
  │    ├─ reader profile and summary preferences
  │    └─ feedback-derived prompt guidance
  ├─ local history search / ranking
  └─ extension service worker
       └─ http://127.0.0.1:8787
            └─ local Node.js / Express backend
                 ├─ request validation + rate limiting
                 ├─ provider capability discovery
                 ├─ fast/quality model router
                 ├─ prompt + structured-output parser
                 ├─ in-memory TTL cache + single-flight requests
                 ├─ persistent daily aggregate usage cap/counters
                 └─ provider adapters
                      ├─ Google Gemini
                      ├─ OpenAI Chat Completions
                      └─ Anthropic Messages
```

The backend binds only to `127.0.0.1`. Do not expose it on `0.0.0.0` or forward its port. The extension still has no LinkedIn page permissions, content script, cookies, or DOM access.

## Requirements

- Node.js 20 or newer
- Chrome / Chromium with Manifest V3 support
- At least one provider API key configured in `server/.env`
- Your existing V7 Gemini key is sufficient for the basic V9 experience. OpenAI and Anthropic are optional and may incur separate charges.

## Upgrade from V7

1. Stop the V7 server with `Ctrl+C`.
2. Extract this archive to a **new folder** and keep a backup of V7.
3. Copy your V7 `server/.env` into the new `server/` folder. Do not replace it with `.env.example`; this preserves your API key and extension ID.
4. Open `chrome://extensions` and load the new `extension/` folder.
5. If Chrome assigns a different extension ID, update `EXTENSION_ID` in `server/.env`.
6. Run:

```bash
cd server
npm install
npm test
npm run dev
```

7. Open the extension and accept the updated V9 AI-provider data-use disclosure.
8. Paste a harmless test post and try the General and Technical modes.

Chrome local storage is scoped to the extension ID. To keep V7 history, back up V7 and replace the files inside the existing unpacked `extension/` folder with V9's extension files, then reload that same folder in Chrome. If you load V9 from a new folder and Chrome creates a new ID, it gets separate local storage; export V7 data as a backup because this release does not include a data-import wizard. The full V9 archive does not include your `.env`, local counters, or extension user data.

## Provider configuration

`server/.env.example` contains the complete configuration surface. Copy the values you need into your private `server/.env`.

### Gemini only (recommended for your current setup)

Keep the existing values:

```env
GEMINI_API_KEY=your_existing_key
GEMINI_MODEL=gemini-3.5-flash-lite
AI_DEFAULT_PROVIDER=gemini
AI_FAST_PROVIDER=gemini
AI_QUALITY_PROVIDER=gemini
```

### Optional OpenAI

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-6-luna
```

### Optional Anthropic

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-haiku-5-5
```

These model defaults reflect provider model catalogs checked for this release; model access and naming can change. Check the provider's current docs/account if an API returns 404. The app does not automatically buy access or provide a free API quota.

### Configure automatic fast/quality routing

Example: Gemini for routine summaries and OpenAI for technical/detailed summaries:

```env
AI_DEFAULT_PROVIDER=gemini
AI_FAST_PROVIDER=gemini
AI_QUALITY_PROVIDER=openai
```

The `AI_FAST_MODEL` and `AI_QUALITY_MODEL` values can override the selected provider's default model. Provider-specific `OPENAI_FAST_MODEL`, `OPENAI_QUALITY_MODEL`, `ANTHROPIC_FAST_MODEL`, and similar values can also be used when a provider is selected explicitly. The backend uses only configured provider IDs and never accepts arbitrary endpoint URLs from the extension.

### API cost estimates

Optional token rates can be configured per provider:

- `GEMINI_INPUT_USD_PER_1M_TOKENS`, `GEMINI_OUTPUT_USD_PER_1M_TOKENS`
- `OPENAI_INPUT_USD_PER_1M_TOKENS`, `OPENAI_OUTPUT_USD_PER_1M_TOKENS`
- `ANTHROPIC_INPUT_USD_PER_1M_TOKENS`, `ANTHROPIC_OUTPUT_USD_PER_1M_TOKENS`

Generic `AI_INPUT_USD_PER_1M_TOKENS` / `AI_OUTPUT_USD_PER_1M_TOKENS` rates are used only when provider-specific rates are blank. For multi-provider use, set provider-specific rates for every provider you use. The dashboard marks the estimate incomplete if any call has no rates or usage data. Estimates are approximate and are not billing statements. Set rates from your current provider plan/pricing.

Keep `server/.env` private and never commit or share it.

## Daily usage and evaluation

- `DAILY_MODEL_CALL_LIMIT` caps provider-call attempts per UTC day; default is 50. `0` means unlimited. Cache hits do not consume the cap.
- `RATE_LIMIT_PER_MINUTE`, `MODEL_TIMEOUT_MS`, and cache settings remain configurable.
- Aggregate daily usage is stored in `server/data/daily-usage.json`; it contains counts, tokens, and cost estimates only.
- Run the local smoke evaluation after starting the backend:

```bash
npm run eval
```

By default it sends four synthetic test posts through your configured route. These can consume provider calls and quota; reduce `EVAL_MAX_CASES` or avoid running it when you do not want additional API usage. The report is saved to `server/data/evaluation-report.json` and is gitignored.

## Privacy and LinkedIn boundary

- The user manually pastes text; no page scraping, content scripts, LinkedIn host permissions, cookies, or hidden APIs are used.
- Submitted text and selected profile/feedback guidance are sent to the chosen configured AI provider through the local backend.
- Provider API keys remain in local `server/.env`.
- Optional history, feedback, and user profile are stored in Chrome local storage on this device.
- History search runs locally and does not send search queries to the provider.
- The feedback-derived prompt hint is sent only when the user explicitly enables that setting.
- The local server stores aggregate usage metadata, not source posts or summaries.

LinkedIn integration remains intentionally excluded. Do not add DOM scraping or automated page extraction as a workaround for unavailable API permissions.

## Chrome Web Store preparation

The Chrome Web Store, reviewer, privacy, and support documents under `docs/` are V9 drafts. They still need publisher details, hosted HTTPS pages, genuine screenshots, and a practical companion-server installation path before any submission. The extension-only archive is a developer/reviewer package and still requires the companion local backend and user-supplied provider key; it is not a one-click consumer release.

Build the extension-only upload package:

```bash
npm run release
```

This creates `dist/linkedin-tldr-v0.9.0-chrome-store.zip` with `manifest.json` at the ZIP root. It intentionally excludes the Node.js backend.

## Project structure

```text
extension/
  icons/icon128.png
  history-search.js
  manifest.json
  popup.html
  popup.css
  popup.js
  service-worker.js
server/
  .env.example
  evaluation/scenarios.json
  scripts/build-release.mjs
  scripts/evaluate.js
  src/
    app.js
    cache.js
    daily-usage.js
    evaluation-score.js
    index.js
    model-router.js
    prompt.js
    providers.js
    security.js
    validation.js
  test/
    app.test.js
    cache.test.js
    daily-usage.test.js
    evaluation.test.js
    history-search.test.js
    model-router.test.js
    prompt-v9.test.js
    prompt.test.js
    providers.test.js
    security.test.js
    validation.test.js
docs/
store-assets/
```
