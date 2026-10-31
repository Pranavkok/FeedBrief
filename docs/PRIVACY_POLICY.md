# Privacy Policy — LinkedIn TL;DR

_Last updated: October 31, 2026_

This policy describes the local 0.7.0 developer release of LinkedIn TL;DR. The publisher must replace the product contact section and host this document at a public HTTPS URL before any Chrome Web Store submission.

## What the extension does

LinkedIn TL;DR summarizes text that you manually paste into its popup. It does not read LinkedIn pages, scrape feeds, access LinkedIn cookies, or collect page content automatically.

## Information processed

When you request a summary, the text you pasted and the summary options you selected are sent from the extension to a Node.js server running on your device. That server sends the submitted text and instructions to Google Gemini to generate the summary. Google's processing is subject to the terms and privacy information that apply to your Google AI/Gemini account and service.

The extension can store the following in `chrome.storage.local` on your device:

- Summary history, including the source text, only when you turn on the history option.
- Summary preferences and history-retention settings.
- Your acknowledgment of the Gemini data-use notice.
- Optional usefulness ratings. Ratings do not include the source post or summary content and are not transmitted by this extension.

The local backend stores aggregate daily API-call, token, and optional cost counters in `server/data/daily-usage.json`. It does not write source text or generated summaries to that usage file. Runtime counters shown in the Usage page are also aggregate counters.

## Sharing

Submitted text is shared with Google Gemini only to provide the summary you requested. This local developer build does not send submitted text, summaries, history, or ratings to the extension developer, an analytics provider, or an advertising provider. Do not paste confidential or sensitive content unless you are authorized to share it with the AI provider and accept the provider's applicable terms.

## Storage and retention

History is off by default. If enabled, entries are stored locally in your Chrome profile and expire according to your selected setting: 7, 30, or 90 days, or manual deletion. You can delete individual entries, clear all history, export your local data, or delete all extension-local data from Settings. Feedback is stored locally, up to the most recent 100 ratings. Chrome profile backups or device backups may retain previous copies outside the extension's control.

Daily aggregate usage data is stored by the companion backend on the device and rotates at 00:00 UTC. You can delete `server/data/daily-usage.json` while the server is stopped to remove the persisted daily counters.

## Security

The companion server binds to `127.0.0.1` and applies request limits, input validation, timeouts, and browser-origin checks. Keep your Gemini API key in `server/.env`; do not share it. CORS checks are not authentication against other local programs. Do not expose the local server to the public internet or forward its port.

## Children's privacy

This developer release is not designed for children under 13.

## Changes

If data practices change, this policy and the in-product disclosures must be updated before distributing the changed build.

## Publisher contact

**Publisher:** [Add your legal/developer name before publication]  
**Contact:** [Add a monitored support email or support URL before publication]
