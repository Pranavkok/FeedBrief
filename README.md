# LinkedIn TL;DR — Private Prototype (V4 + V5)

A local, paste-first Chrome extension for summarizing professional social-media posts. This release builds on the V3 structured-summary/cache implementation with V4 reliability/security improvements and V5 history, personalization, export, and usage features.

> **Platform boundary:** This extension does not read LinkedIn pages, scrape posts, click “see more”, inject controls, automate LinkedIn, or use LinkedIn cookies. You explicitly paste text. This is a private prototype, not an approved LinkedIn integration and not ready for Chrome Web Store distribution. Do not add page access or automation without reviewing current LinkedIn terms and obtaining the required authorization.

## V4 — reliability and hardening

- Server-side upstream request timeout (`MODEL_TIMEOUT_MS`) plus extension-to-backend timeout.
- Strict request schema: text length, allowed values, and unknown fields are validated.
- Input size limit (20,000 characters) and JSON body limit (64 KB).
- Local API accepts browser origins only from valid Chrome extension IDs; optionally pin the exact extension ID using `EXTENSION_ID`.
- Backend binds to `127.0.0.1` only.
- API rate limiting, safe provider error messages, graceful shutdown, and no logging of post text or credentials.
- Cache key includes normalized source text, model, prompt version, summary length, writing style, and language.
- LRU/TTL cache and single-flight handling for concurrent identical requests.
- Automated unit and HTTP-level tests for validation, caching, origin rules, timeouts, and metrics.

## V5 — user experience and personalization

- Opt-in local history: saves both the source text and summary in Chrome extension storage on this device. History is not synced by this extension. You can delete individual entries or clear all history.
- Summary preferences: concise / standard / detailed; neutral / simple / technical; same language as source / English / Hindi / Marathi / Hinglish.
- Preferences persist locally in the Chrome profile.
- Export the current summary as Markdown (`.md`) or plain text (`.txt`).
- Usage dashboard: request count, Gemini calls, cache hits, cache hit rate, token usage, cached entries, errors, and estimated cost.
- Cost estimate is optional and depends on the token rates you configure in `.env`. It is an estimate, not a billing statement. Confirm current rates and your actual tier in Google AI Studio before setting them.

## Requirements

- Node.js 20 or newer
- Chrome / Chromium with Manifest V3 support
- A Gemini API key for live summarization

## Upgrade from V3 without losing your API key

1. Stop the old backend with `Ctrl+C`.
2. Keep a backup of the V3 folder.
3. Extract this ZIP to a **new** folder first. Do not overwrite your current `server/.env`.
4. Copy your existing `server/.env` into this package's `server/` folder. Keep your API key private; do not paste it into chat or screenshots.
5. Open Chrome at `chrome://extensions`, enable Developer mode, and use **Load unpacked** to select this package's `extension/` folder. Note the extension ID shown by Chrome.
6. Open `server/.env` and preserve your working `GEMINI_MODEL`. Set `EXTENSION_ID=your_32_character_id` to restrict browser requests to this extension. You may copy the optional settings from `.env.example` if they are missing. Leave `EXTENSION_ID` blank only for local development when you accept that other Chrome extensions may also make requests to the local server.
7. Install and test the backend:

```bash
cd server
npm install
npm test
npm run dev
```

8. Check `http://127.0.0.1:8787/health` in a browser. It should return `{ "ok": true, "version": "0.5.0" }`.

The extension ID may differ when loading it from a different folder/location. If it changes, update `EXTENSION_ID` in `server/.env` and restart the backend.

## First run

1. Paste post text into the extension.
2. Choose length, writing style, and summary language.
3. Turn on **Save history on this device** only when you want the source text and summary retained locally.
4. Click **Summarize post**.
5. Use **Export .md** or **Export .txt** to save the summary.
6. Open **Usage** to inspect backend counters. Stats reset when the server restarts.

## Cost estimates

The backend records `promptTokenCount`, `candidatesTokenCount`, and thinking tokens when the model returns usage metadata. It estimates cost as:

`(prompt tokens × input USD rate + output tokens × output USD rate) / 1,000,000`

Set both of these optional variables in `server/.env` using the rates applicable to your model, tier, and billing mode:

```env
GEMINI_INPUT_USD_PER_1M_TOKENS=
GEMINI_OUTPUT_USD_PER_1M_TOKENS=
```

Leave both blank to show token usage without a cost estimate. The app does not assume the free tier or hard-code a price. Cached requests do not add new token usage or estimated cost because they do not make an upstream model call.

## Cache behavior

- Cache is stored in backend memory, not on disk.
- Default TTL: 30 minutes; default maximum: 200 entries.
- Same normalized post + same model and preferences returns a cache hit.
- Simultaneous identical requests share one Gemini call.
- Changing the language, length, style, model, or prompt version creates a different cache key.
- Restarting the backend clears the cache and resets usage metrics.
- `/metrics` reports aggregate counters only; it does not expose post text or secrets.

## API

`POST /api/summarize` accepts:

```json
{
  "text": "Post content",
  "length": "standard",
  "tone": "neutral",
  "language": "auto"
}
```

Valid `length`: `concise`, `standard`, `detailed`.

Valid `tone`: `neutral`, `simple`, `technical`.

Valid `language`: `auto`, `en`, `hi`, `mr`, `hinglish`.

`GET /health` returns local server status. `GET /metrics` returns counters and optional cost estimate. These endpoints are available only through loopback and allowed extension-origin rules for browser requests.

## Security and privacy notes

- The Gemini key stays in `server/.env`; `.env` is excluded from Git.
- Backend binds to `127.0.0.1`; no remote host is configured.
- Browser CORS checks are useful guardrails, not authentication against other local programs. Another process running on your computer can still call a loopback port. Do not expose this server on `0.0.0.0` or forward the port.
- Set `EXTENSION_ID` to pin requests to this exact Chrome extension origin. CORS origin checks can still be spoofed by non-browser clients; loopback binding is the main boundary.
- History is opt-in and stored in `chrome.storage.local`. Clearing history removes saved source text and summaries from this extension's local storage. Browser profile backups may retain older data.
- Submitted post text is sent to Google Gemini by the local backend. Avoid submitting confidential or sensitive content unless you have permission and are comfortable with Google's applicable terms.
- No accounts, remote telemetry, analytics, linkedIn DOM access, cookies, or remote code.
- AI summaries can miss nuance or contain errors. Check important details against the source post.

## Project structure

```text
extension/
  manifest.json
  popup.html
  popup.css
  popup.js
  service-worker.js
server/
  .env.example
  package.json
  src/
    app.js
    cache.js
    index.js
    prompt.js
    security.js
    validation.js
  test/
    app.test.js
    cache.test.js
    prompt.test.js
    security.test.js
    validation.test.js
```
