# LinkedIn TL;DR — Private Prototype v2

A deliberately narrow, local prototype for testing post summarization. This version does **not** scrape LinkedIn, inspect its DOM, click "see more", inject controls into LinkedIn, or automate the site. You explicitly paste text into the extension.

This is a technical prototype, **not an approved LinkedIn integration and not ready for Chrome Web Store distribution**. Check the platform's current terms and obtain appropriate authorization before building a LinkedIn-connected product.

## Architecture

- Chrome Extension (Manifest V3): popup UI + service worker.
- Local Node.js backend: validates requests and calls Gemini.
- API key: stored only in the backend `.env`, never in extension files.
- No LinkedIn host permissions, content scripts, cookies, or page access.
- No automatic mode, hover mode, or persistent content cache in this milestone.

## Requirements

- Node.js 20+
- Chrome
- A Gemini API key for local development

## Setup

### 1. Start the local backend

```bash
cd server
cp .env.example .env
# Add your Gemini API key to server/.env
npm install
npm run dev
```

The backend listens on `127.0.0.1:8787`.

### 2. Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `extension/` directory.
5. Open the extension popup, paste a post, and select **Summarize**.

## Security and privacy notes

- Treat `server/.env` as a secret. Never commit it.
- The backend binds to loopback (`127.0.0.1`), not all network interfaces.
- The extension sends only the text you explicitly submit.
- Submitted text is sent to Google's Gemini API by the local backend. Review Google's applicable terms and privacy documentation before using sensitive content.
- The prototype intentionally has no analytics, telemetry, account system, or remote code.
- The local backend has basic request-size and rate limits. These are development safeguards, not production-grade abuse protection.

## Known limitations

- Paste-only input; no LinkedIn page integration.
- Requires the local backend to be running.
- No durable cache, multi-user support, authentication, or production deployment.
- The model output is AI-generated and may omit nuance. Verify important claims.
- The default model name can be changed with `GEMINI_MODEL` in `.env`.

## Tests

```bash
cd server
npm test
```
# FeedBrief
