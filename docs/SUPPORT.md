# Support — LinkedIn TL;DR V9

## First setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` inside `server/`.
3. Add at least one API key: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`.
4. Load the `extension/` folder at `chrome://extensions` and copy its ID into `EXTENSION_ID` in `server/.env`.
5. Run `npm install` and `npm run dev` from `server/`.
6. Reload the extension and accept the provider data-use notice.

## Common issues

- **Cannot reach local backend:** confirm the server is running on `127.0.0.1:8787`.
- **Origin not allowed:** update `EXTENSION_ID` to the ID shown for the currently loaded extension.
- **No provider configured:** add a valid provider key in `server/.env` and restart the server.
- **Provider authentication failed:** check that provider key and project access.
- **Model not found:** set the model field in `.env` to a model enabled for the configured account.
- **Daily model-call limit reached:** wait until 00:00 UTC or adjust `DAILY_MODEL_CALL_LIMIT`.
- **Summary parse failed:** retry; models can occasionally return malformed structured JSON.
- **History search returns no result:** search terms are matched against saved source text, summary text, concepts, and claims; only entries saved in this Chrome profile are searchable.

Never share API keys, private post content, exported history files, or evaluation reports containing content you consider sensitive when requesting support.
