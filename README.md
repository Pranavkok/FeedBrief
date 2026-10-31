# LinkedIn TL;DR — V6 + V7 (0.7.0)

A paste-first Chrome extension that summarizes text the user explicitly submits. It uses a local Node.js companion server and the user's own Google Gemini API key.

> **Platform boundary:** This project does not read LinkedIn pages, scrape feeds, click “see more”, inject controls, automate LinkedIn, or use LinkedIn cookies. There is no LinkedIn host permission or content script. Text is entered manually. The project is not affiliated with, endorsed by, or an official LinkedIn integration.

## What's new

### V6 — product readiness

- First-run notice asks the user to confirm that submitted text is sent to Google Gemini.
- Optional usefulness feedback is stored locally only. Ratings do not include source text and are never transmitted.
- History remains opt-in, with retention settings of 7, 30, 90 days, or manual deletion.
- Settings supports JSON export of local data and deletion of all extension-local data.
- `Ctrl+Enter` / `Command+Enter` summarizes while the popup is open.
- `Ctrl+Shift+L` / `Command+Shift+L` opens the extension popup (the user can remap this in Chrome).
- A persistent daily Gemini call-attempt limit protects against unexpected API usage. Cache hits do not consume the limit.
- Daily aggregate model-call, token, and optional cost usage is stored in `server/data/daily-usage.json`. It contains no prompts, source posts, or summaries.

### V7 — distribution preparation

- Manifest V3 release version is `0.7.0`; a 128×128 extension icon is included.
- `npm run release` creates a Chrome extension upload ZIP with `manifest.json` at its root.
- Store listing copy, permission justifications, reviewer notes, privacy policy draft, and screenshot capture instructions are included under `docs/` and `store-assets/`.
- The extension package still requires its companion local backend and the user's Gemini API key. For that reason, this is a **review candidate / developer package, not yet a one-click public consumer release**.

## Architecture

```text
Chrome popup
  ├─ chrome.storage.local
  │    ├─ optional history (source text + summary)
  │    ├─ preferences + consent state
  │    └─ local usefulness ratings
  │
  └─ extension service worker
       └─ http://127.0.0.1:8787
            └─ local Node.js / Express backend
                 ├─ request validation + rate limiting
                 ├─ in-memory LRU/TTL cache + single-flight requests
                 ├─ persistent daily aggregate usage cap/counters
                 └─ Google Gemini API
```

No source post or generated summary is written to the backend's daily usage file. The backend must remain bound to loopback; do not expose it on `0.0.0.0` or forward its port.

## Requirements

- Node.js 20 or newer
- Chrome / Chromium with Manifest V3 support
- A Gemini API key for live summaries

## Upgrade from V5

1. Stop the V5 backend with `Ctrl+C`.
2. Keep a backup of your V5 folder.
3. Extract this ZIP to a **new folder**. Do not overwrite your old `server/.env`.
4. Copy your V5 `server/.env` into this version's `server/` folder. Keep the API key private.
5. Open `chrome://extensions`, enable Developer mode, and use **Load unpacked** to select this version's `extension/` folder.
6. Copy the extension ID displayed by Chrome into `EXTENSION_ID` in `server/.env`. This is required at startup. The ID may change when loading the extension from a different folder.
7. Add this setting to `server/.env` if it is not already there:

```env
DAILY_MODEL_CALL_LIMIT=50
```

Set it to `0` for unlimited model-call attempts. This limit resets at 00:00 UTC. Cached results do not consume a call.

8. Install and start the backend:

```bash
cd server
npm install
npm test
npm run dev
```

9. Check `http://127.0.0.1:8787/health`. It should return `ok: true` and version `0.7.0`.
10. Open the extension, read and accept the Gemini data-use notice, then paste a harmless test post.

Your V5 `chrome.storage.local` history/preferences keys remain available only when Chrome assigns this build the same extension ID (normally by loading the new files from the exact same unpacked-extension folder path). If you load it from a different path and Chrome gives it a new ID, the old extension data will not automatically appear in this build; export your V5 data first as a backup. The first-run data-use confirmation is new and must be accepted once.

## First run and controls

1. Accept the disclosure that submitted text is sent to Google Gemini.
2. Paste post text manually.
3. Select length, style, and language.
4. Turn on **Save history on this device** only when you want source text and summaries retained locally.
5. Use **Settings** to set retention, export local data, or delete all extension-local data.
6. Rate a summary as Useful / Not useful; the rating is stored locally and is not sent anywhere.
7. Use **Usage** to view the UTC-day call limit, tokens, cache hits, and optional daily cost estimate.

## Backend configuration

`server/.env.example` contains all configuration options. Important settings:

- `GEMINI_API_KEY`: your private Gemini key.
- `GEMINI_MODEL`: model available to your Gemini API project. Preserve your working model setting when upgrading.
- `EXTENSION_ID`: the 32-character Chrome extension ID; configure this after loading the new folder.
- `DAILY_MODEL_CALL_LIMIT`: daily model-call attempt cap; default 50, `0` means unlimited.
- `GEMINI_INPUT_USD_PER_1M_TOKENS` and `GEMINI_OUTPUT_USD_PER_1M_TOKENS`: optional token rates for an estimate. Check current Google pricing and your billing tier before setting these.

Keep `server/.env` private. `.gitignore` excludes it and the aggregate daily usage file.

## Daily usage behavior

- The cap is enforced immediately before a new Gemini API attempt.
- Cache hits and identical in-flight requests do not reserve another model call.
- Failed provider attempts count toward the daily cap, because they still attempt a provider request.
- The count resets at 00:00 UTC.
- `server/data/daily-usage.json` stores aggregate call/token/cost values only. Stop the backend and delete that file to clear persisted daily aggregates.
- The extension Usage screen distinguishes the daily persisted counters from process-lifetime request/cache metrics.
- Cost is only estimated when both rates are configured; it is not a billing statement.

## Chrome Web Store preparation

Read these before attempting publication:

- `docs/CHROME_WEB_STORE.md` — draft listing, single purpose, permission justifications, reviewer steps, remaining publisher actions.
- `docs/PRIVACY_POLICY.md` — privacy policy draft; replace publisher/contact placeholders and host it at a public HTTPS URL.
- `docs/REVIEWER_NOTES.md` — companion server and test instructions.
- `docs/SUPPORT.md` — setup troubleshooting and support-page draft.
- `store-assets/ASSET_CAPTURE_GUIDE.md` — instructions for real store screenshots.

Build the extension-only upload package from `server/`:

```bash
npm run release
```

This creates `dist/linkedin-tldr-v0.7.0-chrome-store.zip`. The release script uses the system `zip` command (available by default on macOS). It contains only the extension files; the companion server is not inside that upload ZIP. The full project archive contains both.

**Do not publish yet** until you decide how end users and reviewers will install/start the companion backend, host the privacy policy/support pages, supply genuine support details, and capture at least one actual 1280×800 or 640×400 screenshot of the shipped UI.

## LinkedIn integration status

The extension remains paste-first. LinkedIn's current self-service API permissions include basic profile/email access through OpenID Connect and `w_member_social` for sharing; these do not provide general feed/post reading. Other API products are subject to approval or partner programs. Do not add scraping, DOM selectors, content scripts, hidden APIs, or cookie reuse as a workaround. See the official API access page linked in `docs/CHROME_WEB_STORE.md`.

## Project structure

```text
extension/
  icons/icon128.png
  manifest.json
  popup.html
  popup.css
  popup.js
  service-worker.js
server/
  .env.example
  package.json
  scripts/build-release.mjs
  src/
    app.js
    cache.js
    daily-usage.js
    index.js
    prompt.js
    security.js
    validation.js
  test/
docs/
  CHROME_WEB_STORE.md
  PRIVACY_POLICY.md
  REVIEWER_NOTES.md
store-assets/
  ASSET_CAPTURE_GUIDE.md
```
