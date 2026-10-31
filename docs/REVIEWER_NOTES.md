# Reviewer notes — LinkedIn TL;DR V9

This is a local developer/reviewer package, not a hosted consumer service. It uses a Manifest V3 Chrome extension plus a companion Node.js 20+ backend bound to `127.0.0.1:8787`.

## Required setup

1. Load the unpacked `extension/` folder from `chrome://extensions`.
2. Copy the extension ID into `EXTENSION_ID` in `server/.env`.
3. Configure at least one provider API key in `server/.env` (Gemini, OpenAI, or Anthropic). The API key belongs to the reviewer/test operator and is not bundled.
4. Run `cd server && npm install && npm test && npm run dev`.
5. Open the popup, review and accept the V9 provider data-use disclosure, paste non-sensitive sample text, and request a summary.

## Expected behavior

- Provider selection lists only provider keys configured in the local backend.
- Auto routing uses the configured fast/quality routes; no hidden failover occurs.
- Summary modes include General, Beginner, Technical, and Executive.
- Structured output may include key concepts, claims, examples, caveats, and action items.
- History, preferences, and feedback remain in Chrome local storage.
- History search executes locally and does not call an AI provider.
- The extension has no LinkedIn host permission, content script, page script, cookies, or feed automation.

The reviewer can inspect `GET /health`, `GET /api/capabilities`, and `GET /metrics` on the local backend. The capabilities endpoint returns provider names/model IDs only, never API keys.
