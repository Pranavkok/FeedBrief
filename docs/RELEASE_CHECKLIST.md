# V9 (0.9.0) release checklist

- [ ] Install dependencies with `npm install` on Node.js 20+.
- [ ] Run `npm test` and review any integration-test failures.
- [ ] Run `npm run release` and verify the extension-only ZIP.
- [ ] Confirm ZIP root contains `manifest.json`, `popup.html`, `popup.js`, service worker, CSS, history search, and icons.
- [ ] Verify no `.env`, API key, `node_modules`, local usage data, or user history is in either release archive.
- [ ] Load the extension in a clean Chrome profile and pin its ID in `server/.env`.
- [ ] Test all four summary modes, all languages, provider selection, fast/quality routing, and provider-not-configured errors.
- [ ] Verify structured extraction, local history search, local feedback adaptation, retention, export/delete controls, keyboard shortcuts, daily caps, caching, and usage reporting.
- [ ] Test a provider timeout, invalid JSON response, quota error, and daily model-call cap.
- [ ] Run `npm run eval` only when you are comfortable spending up to `EVAL_MAX_CASES` provider calls.
- [ ] Test with a fresh Chrome profile and non-sensitive sample posts.
- [ ] Capture real UI screenshots; do not use mockups.
- [ ] Host the privacy policy and support page at stable HTTPS URLs and replace publisher/contact placeholders.
- [ ] Complete the Chrome Web Store privacy-practices form and permission justifications.
- [ ] Confirm a practical companion-server installation path for reviewers and end users.
- [ ] Re-check LinkedIn API access and platform terms before introducing any LinkedIn integration.
