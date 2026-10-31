# Privacy policy — LinkedIn TL;DR V9

This document describes the local V9 developer release. Before any public distribution, the publisher must replace contact placeholders, host this policy at a public HTTPS URL, and review it against the exact provider(s) offered to users and the applicable Chrome Web Store requirements.

## Data submitted for summarization

When a user requests a summary, the manually pasted source text, selected summary controls, and selected reader profile preferences are sent from the extension to a Node.js backend running on that user's device. The backend forwards the request to the configured AI provider: Google Gemini, OpenAI, or Anthropic. Only providers for which the local server has an API key are available. The provider's own terms and privacy practices govern its processing of that request.

The extension does not read LinkedIn pages, access LinkedIn cookies, collect feed contents automatically, or use hidden LinkedIn APIs. Users should not paste confidential or sensitive material unless authorized to share it with the configured provider.

## Local data

The following data is stored in Chrome's local extension storage when applicable:

- Optional summary history, including the source text and generated summary.
- User-selected summary preferences and reader profile (expertise and topic focus).
- Optional usefulness ratings and feedback reasons.
- First-run provider data-use consent.

History and feedback are not synced by this extension. The local history-search feature searches saved material on-device; search queries are not sent to an AI provider.

If the user enables **Apply my local feedback**, repeated feedback reasons may be converted into a short preference hint and included in a future provider request. The raw feedback list remains local.

## Local backend data

The backend writes aggregate provider-call counts, token counts, and optional estimated cost to `server/data/daily-usage.json`. It does not write prompts, source posts, summaries, reader profile values, or feedback. The evaluation report stores case IDs, provider/model, scores, and term-coverage metadata only; it does not store source cases or model output text.

## API keys

Provider API keys are stored in the user's local `server/.env` file. They are not included in the extension package and are not transmitted to the extension UI. Do not commit or share `server/.env`.

## Network and security

The local backend binds to `127.0.0.1`, uses request validation, rate limiting, request timeouts, and an extension-origin check. The origin check is a browser CORS guardrail, not authentication against other local programs. Do not expose the backend to the public internet or forward its port.

## Retention and deletion

Users can configure local history retention, export local data, delete individual summaries, clear history, or delete all extension-local data from Settings. Backend aggregate usage can be cleared by stopping the backend and deleting `server/data/daily-usage.json`. Evaluation reports can be deleted from `server/data/`.

## Contact

Publisher: [Replace with publisher name]
Support: [Replace with support email]
Policy URL: [Replace with hosted HTTPS URL]
