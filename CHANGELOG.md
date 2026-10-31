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
