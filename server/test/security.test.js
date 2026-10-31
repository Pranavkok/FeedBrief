import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedExtensionOrigin, parseExtensionId } from "../src/security.js";

const extensionId = "abcdefghijklmnopabcdefghijklmnop";

test("allows a syntactically valid Chrome extension origin", () => {
  assert.equal(isAllowedExtensionOrigin(`chrome-extension://${extensionId}`), true);
  assert.equal(isAllowedExtensionOrigin("https://example.com"), false);
  assert.equal(isAllowedExtensionOrigin("null"), false);
});

test("locks the origin to a configured extension ID", () => {
  assert.equal(isAllowedExtensionOrigin(`chrome-extension://${extensionId}`, extensionId), true);
  assert.equal(isAllowedExtensionOrigin("chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba", extensionId), false);
});

test("validates extension ID configuration", () => {
  assert.equal(parseExtensionId(""), "");
  assert.equal(parseExtensionId(extensionId), extensionId);
  assert.throws(() => parseExtensionId("not-an-id"));
});
