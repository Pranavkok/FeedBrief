# Changelog

## 0.5.0 — V4 + V5

### V4
- Added strict request validation, request/body limits, configurable API rate limiting, backend timeout, safer errors, graceful shutdown, and optional extension-origin pinning.
- Retained the local-only backend, LRU/TTL cache, and duplicate-request coalescing.
- Added more automated tests, including HTTP-level tests for caching, CORS, cost metrics, and timeouts.

### V5
- Added opt-in device-local summary history with per-entry deletion and clear-all.
- Added simple writing style and same-as-source, English, Hindi, Marathi, and Hinglish summary languages.
- Persisted summary preferences locally.
- Added Markdown and plain-text exports.
- Added usage dashboard with request/cache/model counters, token usage, and optional configurable USD cost estimates.
- Kept platform integration paste-only; no LinkedIn DOM access or automation was introduced.

## V6 + V7 (0.7.0)

### V6 — product readiness
- First-run, affirmative disclosure explaining that submitted text is sent to Google Gemini.
- Local-only usefulness feedback; rating events do not include source text and are not transmitted.
- Configurable local history retention (7 / 30 / 90 days, or manual deletion).
- Export all local extension data as JSON and delete all local data from Settings.
- Keyboard shortcuts: Ctrl/Cmd+Enter summarizes in the open popup; Ctrl/Command+Shift+L opens the popup.
- Persistent UTC-day Gemini model-call cap; cached responses do not consume the cap.
- Daily aggregate usage/cost persisted without storing post text or summaries.

### V7 — distribution preparation
- Manifest and extension version bumped to 0.7.0; extension icon and store package build script added.
- Chrome Web Store listing copy, reviewer notes, permission justifications, privacy policy draft, and submission checklist included.
- No LinkedIn page permissions, scraping, DOM automation, cookies, or feed-reading API integration added.
- A Chrome Web Store upload package can be generated, but public submission is still gated on hosting the privacy policy/support details and deciding how users will install/run the companion local backend.
