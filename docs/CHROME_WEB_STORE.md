# Chrome Web Store submission draft — LinkedIn TL;DR 0.7.0

## Submission status

**Not ready for public publication yet.** The extension package can be generated for a dry run, but this release still requires a companion local Node.js server and the user's own Gemini API key. The Chrome Web Store reviewer and end users would need clear instructions and a reliable way to install/start that companion service. A public HTTPS privacy-policy URL and real support contact also need to be supplied by the publisher. A support-page draft is included in `docs/SUPPORT.md`. Do not claim the extension is an official LinkedIn integration.

## Proposed listing

**Name:** LinkedIn TL;DR — Post Summarizer  
**Short description:** Summarize text you choose with Google Gemini. Paste-only; no LinkedIn page access.  
**Category:** Productivity  
**Language:** English

**Detailed description:**

LinkedIn TL;DR turns professional posts you choose into a structured summary with a TL;DR, key takeaways, and why it matters.

- Paste text manually; nothing is read automatically from LinkedIn.
- Choose concise, standard, or detailed summaries.
- Choose neutral, simple, or technical writing style.
- Summarize in the source language, English, Hindi, Marathi, or Hinglish.
- Optionally keep summary history in this Chrome profile, with configurable retention.
- Export summaries and your local extension data.
- Review API usage, cache hits, daily Gemini-call limits, and optional cost estimates.

The extension sends only text you submit and its summary options to Google Gemini through a companion local Node.js server. You need your own Gemini API key and must run the local server. Saved history and feedback remain in Chrome local storage and are not synced by this extension.

This product is not affiliated with, endorsed by, or an official integration of LinkedIn.

## Single-purpose statement

Summarize text that a user explicitly pastes into the extension using the user's configured Google Gemini API connection.

## Permission justifications

- `storage`: store the user's preferences, optional local summary history, privacy confirmation, and local feedback in `chrome.storage.local`.
- `http://127.0.0.1:8787/*`: communicate with the companion local Node.js backend running on the same device to request summaries and retrieve aggregate usage metrics.
- `commands`: no permission grant is required for the declared `_execute_action` keyboard shortcut; it only opens the extension popup.

No `tabs`, `activeTab`, `scripting`, `content_scripts`, LinkedIn host permissions, cookies, or `<all_urls>` access are requested.

## User-data / privacy disclosures to enter in the dashboard

- **Purpose:** summarize user-submitted text.
- **Data handled:** user-provided post text; optional locally saved post text and summaries; settings; local feedback ratings; aggregate API usage counters.
- **Data sharing:** submitted text and selected summary preferences are sent to Google Gemini by the user's local backend. The extension developer does not receive this content in this local release.
- **Local storage:** preferences, optional source text + summaries, privacy acknowledgment, and feedback ratings are stored in the user's Chrome local profile. The extension does not sync them.
- **Backend storage:** daily aggregate request/token/cost counters are stored under `server/data/daily-usage.json`; no prompt or summary text is persisted by that counter store.
- **Retention:** optional history is controlled by the user and expires after the selected 7 / 30 / 90 days unless set to manual deletion. Feedback is retained locally up to the last 100 ratings or until local data is cleared. Aggregate daily usage is rotated by UTC date.
- **Not collected:** LinkedIn cookies, feed/page content, browsing history, precise location, or telemetry.

The publisher must verify these disclosures against the final build before submission. Update this document and the privacy policy if behavior changes.

## Reviewer test instructions

1. Install Node.js 20 or newer.
2. Install the companion server dependencies from the supplied source package.
3. Configure a test Gemini API key in `server/.env` and set the extension ID after loading the unpacked extension.
4. Start the server with `npm run dev` from `server/`.
5. Open the extension, accept the Gemini data disclosure, paste sample non-sensitive text, and summarize.
6. Verify history is opt-in, feedback remains local, export works, and the daily call limit appears in Usage.
7. Confirm the extension does not access LinkedIn pages or request LinkedIn permissions.

Do not submit a production API key or personal post content to reviewers. Create a dedicated test key with quota limits.

## Publisher actions still required

- Publish `PRIVACY_POLICY.md` at a stable public HTTPS URL and enter it in the Developer Dashboard.
- Supply a support page and real support contact details; do not use placeholder addresses.
- Capture at least one real, current 1280x800 Chrome extension screenshot (maximum five); no mock screenshots.
- Confirm the reviewer can run the companion backend, or replace the local backend with a properly hosted service before public release.
- Complete the Chrome Web Store privacy-practices form and permission justifications accurately.
- Create the developer account, pay applicable registration fee, upload the release ZIP, and complete review. These actions require the publisher's account and explicit participation.

## Build the extension upload ZIP

From the `server/` directory:

```bash
npm run release
```

The script creates `dist/linkedin-tldr-v0.7.0-chrome-store.zip`. The ZIP contains the extension directory only (with `manifest.json` at the root). It intentionally excludes the companion server; reviewers need the separately supplied source bundle and setup instructions.

## Updates after publication

Once an approved item is published through the Chrome Web Store, users receive extension updates through Chrome Web Store update delivery when the publisher uploads a new version. Unpacked developer installs still need to be manually reloaded or replaced. This project does not implement a separate updater.

## Official policy references checked for this draft

- LinkedIn API access and permission overview: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- LinkedIn API Terms: https://developer.linkedin.com/legal
- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome Web Store privacy-practices fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Chrome Web Store listing and screenshot requirements: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
