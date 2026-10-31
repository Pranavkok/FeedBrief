# Chrome Web Store submission draft — LinkedIn TL;DR V9

**Not ready for public publication.** V9 remains a local developer/reviewer package that requires a companion local Node.js backend and at least one provider API key supplied by the user. The publisher must design a supported end-user backend installation experience, host a privacy policy/support page, supply genuine contact details, and capture real screenshots before submission.

## Draft listing

**Name:** LinkedIn TL;DR — Post Summarizer

**Short description:** Summarize text you choose with a locally configured AI provider. Paste-only; no LinkedIn page access.

**Single purpose:** Summarize text that a user explicitly submits to the extension.

## Data disclosure

The submitted text and selected summary options/profile guidance are sent to the AI provider configured by the user through a local Node.js backend. Supported adapters are Gemini, OpenAI, and Anthropic; keys remain in the local backend `.env`. Optional history, profile preferences, and feedback are stored in Chrome local storage. History search is local. Feedback-derived prompt guidance is sent only when the user enables that option.

The extension does not inspect LinkedIn pages, access LinkedIn cookies, scrape feed content, or use remote analytics.

## Permissions

- `storage`: retain user-approved settings, consent, optional history, and feedback in Chrome local storage.
- `http://127.0.0.1:8787/*`: communicate with the user's local companion server.

No LinkedIn host permission, `tabs`, `scripting`, `activeTab`, or broad URL permission is required.

## Remaining publisher actions

- Decide how end users and reviewers will install/start the local companion server.
- Host the completed privacy policy and support pages using HTTPS.
- Replace publisher/contact placeholders.
- Capture real screenshots of the shipped extension UI.
- Recheck Chrome Web Store disclosure and limited-use requirements against the exact final data flow.

Do not claim the extension is an official LinkedIn integration or add unauthorized page scraping as a workaround for unavailable LinkedIn API access.
