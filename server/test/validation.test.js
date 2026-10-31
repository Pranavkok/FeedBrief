import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CHARS, validatePostText } from "../src/validation.js";

test("accepts and trims valid text", () => {
  assert.deepEqual(validatePostText("  Hello world  "), { ok: true, text: "Hello world" });
});

test("rejects empty and non-string input", () => {
  assert.equal(validatePostText("   ").ok, false);
  assert.equal(validatePostText(null).ok, false);
});

test("rejects text above the configured limit", () => {
  const result = validatePostText("x".repeat(MAX_CHARS + 1));
  assert.equal(result.ok, false);
});
