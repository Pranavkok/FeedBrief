import test from "node:test";
import assert from "node:assert/strict";
import { MAX_CHARS, validateRequest } from "../src/validation.js";
test("accepts and trims a valid request with defaults", () => assert.deepEqual(validateRequest({ text: "  Hello world  " }), { ok: true, text: "Hello world", length: "standard", tone: "neutral" }));
test("rejects empty, non-string, and non-object input", () => { for (const body of [null, [], "x", { text: null }, { text: "  " }]) assert.equal(validateRequest(body).ok, false); });
test("rejects text above configured limit", () => assert.equal(validateRequest({ text: "x".repeat(MAX_CHARS + 1) }).ok, false));
test("rejects unsupported controls", () => { assert.equal(validateRequest({ text: "x", length: "huge" }).ok, false); assert.equal(validateRequest({ text: "x", tone: "sarcastic" }).ok, false); });
