# LinkedIn TL;DR — Complete Private Prototype

A local, paste-first Chrome extension for summarizing professional posts. This package improves the previous private prototype with structured summaries, user controls, a polished popup, server-side caching, duplicate-request coalescing, diagnostics, tests, and a documented integration boundary.

> **Scope and platform boundary:** This prototype does not read LinkedIn pages, scrape posts, click “see more”, inject controls, automate LinkedIn, or use LinkedIn cookies. You explicitly paste text. This is not an approved LinkedIn integration and is not ready for Chrome Web Store distribution. Do not add page access or automation without reviewing current LinkedIn terms and obtaining the required authorization.

## What is included

- Structured output: TL;DR, key takeaways, and “Why it matters” only when supported by the post.
- Controls: concise/standard/detailed length and neutral/technical tone.
- Copy summary and copy source text; clear/reset; character count; loading, error, and success states.
- Local Node backend keeps the Gemini key out of the extension.
- SHA-256 keyed in-memory LRU/TTL cache; cache key includes normalized input, model, prompt version, length, and tone.
- Concurrent identical requests share one upstream Gemini call (single-flight).
- Cache metadata (`X-Cache: HIT|MISS|COALESCED`) and safe health/metrics endpoint. No post text or API key is logged.
- Input validation, request-size limit, local-origin CORS, rate limiting, upstream timeout, and unit tests.

## Requirements

- Node.js 20 or newer
- Chrome / Chromium with Manifest V3 support
- Gemini API key for local development

## Upgrade without losing your API key

1. Stop the old backend with `Ctrl+C`.
2. Keep a backup of your current project folder.
3. Extract this ZIP to a new folder first. Do **not** overwrite your existing `server/.env`.
4. Copy your existing `server/.env` into the new package's `server/` folder. If you do not have one, copy `.env.example` to `.env` and add your key.
5. In `server/.env`, keep your existing valid model if it works. The example defaults to `gemini-3.5-flash-lite`; model availability depends on your Google AI project.
6. Install and start the backend:

```bash
cd server
npm install
npm test
npm run dev
```

7. In Chrome, open `chrome://extensions`. Find the existing extension and click **Reload**. If Chrome does not pick up the new files, remove the old unpacked entry and use **Load unpacked** to select the new `extension/` folder.
8. Check `http://127.0.0.1:8787/health` in a browser. It should return `{ "ok": true }`.

The extension ID may change if you remove and reload it as a new unpacked extension. This package allows Chrome extension origins for the local prototype; it never grants LinkedIn page access.

## How caching works

- Cache is held in server memory, not in Chrome storage or on disk.
- Identical normalized text + same model + same controls returns a cached summary for 30 minutes.
- Cache is bounded to 200 entries (least-recently-used eviction).
- Simultaneous identical requests share one model request.
- Changing length, tone, model, or prompt version intentionally produces a different cache key.
- Restarting the backend clears the cache. This avoids storing submitted post text persistently.
- `GET /health` reports status; `GET /metrics` reports counts only (requests, cache hits/misses, coalesced requests, model calls, errors, and cache entries). It does not expose post text or secrets.

To verify a cache hit, submit identical text with identical controls twice. In DevTools Network, both requests may still reach the local backend; inspect the second response header `X-Cache: HIT`. The server metrics endpoint should show the hit increasing while `modelCalls` does not increase.

## API contract

`POST /api/summarize` JSON body:

```json
{ "text": "...", "length": "standard", "tone": "neutral" }
```

Response includes `summary`, structured `sections`, `model`, `cached`, and `durationMs`. `X-Cache` is `MISS`, `HIT`, or `COALESCED`.

## Security and privacy

- Backend binds only to `127.0.0.1`.
- Gemini key belongs in `server/.env`; never paste it into extension code, screenshots, or chat.
- `.env` is ignored by Git.
- No analytics, telemetry, accounts, persistent post storage, LinkedIn DOM access, cookies, or remote code.
- Submitted text is sent to Google Gemini by your local backend. Do not submit confidential or sensitive content unless you have permission and are comfortable with the provider's applicable terms.
- Local rate limiting and origin checks are development safeguards, not production-grade authentication.

## Known limitations

- Cache is in-memory and local to one server process.
- No authentication; loopback binding is the primary local boundary.
- AI summaries can omit nuance or be wrong; verify important claims against the original post.
- “Why it matters” is omitted when the post does not support a grounded implication.
- This package does not implement a LinkedIn integration. A future connected version must use authorized APIs/permissions and comply with current platform terms; a paste workflow is the supported baseline here.
