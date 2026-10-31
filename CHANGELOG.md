# Changelog

## V9 (0.9.0)

- Added provider adapters for Gemini, OpenAI Chat Completions, and Anthropic Messages. Gemini remains the default; other providers are optional and require user-supplied keys in the local `.env`.
- Added provider capability discovery and automatic fast/quality routing based on summary mode, detail level, reader expertise, and source length.
- Added explicit provider and model-routing preferences in the extension UI.
- Added General, Beginner, Technical, and Executive summary modes.
- Expanded structured output to include concepts, author claims, source examples, caveats, and author-stated action items.
- Added locally stored reader expertise, focus areas, and opt-in feedback-derived prompt guidance.
- Added local relevance-ranked search over saved source text, summaries, and AI-extracted concepts/claims; search queries do not leave the device.
- Added a synthetic evaluation dataset, deterministic scoring rubric, and local-backend evaluation command.
- Added provider-specific token-rate configuration for approximate cost estimates.
- Updated first-run disclosure to describe the provider selected/configured by the user.
- Kept V7's local Node.js backend, history storage, daily call cap, cache, and paste-only LinkedIn boundary.

## V6 + V7 (0.7.0)

- First-run data-use disclosure and consent.
- Local feedback, history retention, data export/delete controls, keyboard shortcuts, and daily provider-call limit.
- Chrome Web Store submission draft, support/privacy documents, release packaging script, and screenshots guide.
- Manifest V3 extension release preparation.

## V4 + V5 (0.5.0)

- Structured summaries, summary preferences, local history, caching, usage metrics, and product UI improvements.
