# V6/V7 release checklist

- [ ] `npm test` passes on Node.js 20+.
- [ ] `npm run release` creates the extension-only package.
- [ ] ZIP root contains `manifest.json`, `popup.html`, `popup.js`, service worker, CSS, and icons.
- [ ] Load unpacked from the release `extension/` folder and pin that new extension ID in `server/.env`.
- [ ] Verify consent gating, local-only history/feedback, retention, export, delete-all, keyboard shortcuts, daily cap, and cache hits.
- [ ] Test with a fresh Chrome profile and a non-sensitive sample post.
- [ ] Capture real UI screenshots; do not use mockups.
- [ ] Host the privacy policy and support page at stable HTTPS URLs.
- [ ] Complete the Chrome Web Store privacy-practices form and permission justifications.
- [ ] Confirm a practical companion-server installation path for reviewers and end users.
- [ ] Re-check LinkedIn API access and platform terms before introducing any integration.
