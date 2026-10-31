import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CHARS, validateRequest } from "../src/validation.js";

test("accepts trimmed text and defaults", () => {
  assert.deepEqual(validateRequest({ text: "  Hello world  " }), {
    ok: true, text: "Hello world", length: "standard", tone: "neutral", language: "auto",
    mode: "general", provider: "auto", modelPreference: "auto",
    profile: { expertise: "auto", focusAreas: "", feedbackHints: "" }
  });
});

test("rejects invalid body, missing text, and empty text", () => {
  for (const body of [null, [], "x", {}, { text: null }, { text: "  " }]) {
    assert.equal(validateRequest(body).ok, false);
  }
});

test("enforces the character limit", () => {
  assert.equal(validateRequest({ text: "x".repeat(MAX_CHARS + 1) }).ok, false);
  assert.equal(validateRequest({ text: "x".repeat(MAX_CHARS) }).ok, true);
});

test("rejects unsupported controls and unexpected fields", () => {
  assert.equal(validateRequest({ text: "x", length: "huge" }).ok, false);
  assert.equal(validateRequest({ text: "x", tone: "sarcastic" }).ok, false);
  assert.equal(validateRequest({ text: "x", language: "xx" }).ok, false);
  assert.equal(validateRequest({ text: "x", mode: "unknown" }).ok, false);
  assert.equal(validateRequest({ text: "x", provider: "unknown" }).ok, false);
  assert.equal(validateRequest({ text: "x", modelPreference: "cheap" }).ok, false);
  assert.equal(validateRequest({ text: "x", profile: { focusAreas: "a".repeat(121) } }).ok, false);
  assert.equal(validateRequest({ text: "x", debug: true }).ok, false);
});
