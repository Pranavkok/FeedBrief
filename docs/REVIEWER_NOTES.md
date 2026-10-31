# Reviewer notes

## Purpose

The extension summarizes text a user explicitly pastes into its popup. It does not interact with LinkedIn pages.

## Required local companion

This 0.7.0 release uses a local Node.js companion backend at `http://127.0.0.1:8787`. A test reviewer needs Node.js 20+, a Gemini API key, and the companion source. The extension is not functional until that service is configured and running.

## Permission review

- `storage`: optional local history, preferences, one-time data-use acknowledgment, and local usefulness ratings.
- `http://127.0.0.1:8787/*`: only the user's own local backend.
- `_execute_action`: opens the extension popup via a keyboard shortcut.

No permission grants access to LinkedIn or general browsing activity.

## Test content

Use harmless sample text only. Do not use the reviewer's real LinkedIn feed, personal data, confidential company information, or live credentials.
