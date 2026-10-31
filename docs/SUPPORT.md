# LinkedIn TL;DR — Support

This developer release is a paste-first Chrome extension paired with a local Node.js server. It is not an official LinkedIn integration.

## Setup checklist

1. Install Node.js 20 or newer.
2. Load the `extension/` directory in `chrome://extensions` with Developer mode enabled.
3. Copy the extension ID from the extension card into `EXTENSION_ID` in `server/.env`.
4. Add your Gemini API key to `GEMINI_API_KEY` in the same file.
5. Run `npm install` and `npm run dev` from `server/`.
6. Open the extension and accept the first-run data-use notice.

## Common issues

- **Cannot reach local backend:** confirm the server is running and listening at `127.0.0.1:8787`.
- **Local server configuration is invalid:** verify that `EXTENSION_ID` contains the 32-character ID displayed by Chrome, using only letters `a` through `p`.
- **Origin not allowed:** the ID in `server/.env` must match the extension currently loaded in Chrome. Reloading it from another directory can result in another unpacked extension ID.
- **Gemini model not found:** set `GEMINI_MODEL` to a model available to your Google AI Studio project.
- **Daily Gemini call limit reached:** wait until 00:00 UTC or increase `DAILY_MODEL_CALL_LIMIT` in `server/.env`. Set it to `0` for unlimited use.
- **History missing:** confirm that history was enabled before the summary was generated. History is local to the current Chrome profile and expires according to the Settings retention choice.

## Privacy

Do not send API keys, private post content, exported history files, or screenshots containing personal data when requesting support. Summarized text is sent to Google Gemini through the local backend. See `PRIVACY_POLICY.md`.

## Publisher contact

The publisher must add and monitor a real support contact before public distribution: [add support email or support URL].
