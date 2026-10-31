import test from "node:test";
import assert from "node:assert/strict";
import { searchHistory } from "../../extension/history-search.js";

const history = [
  { id: "a", createdAt: "2026-10-30T10:00:00.000Z", summary: "PostgreSQL composite indexes improve database query performance.", sourceText: "EXPLAIN ANALYZE showed the index reduced latency.", sections: { concepts: [{ name: "Composite index", explanation: "Multi-column index." }] } },
  { id: "b", createdAt: "2026-10-29T10:00:00.000Z", summary: "Kafka consumer groups and partitions.", sourceText: "Consumer lag and rebalancing affect processing.", sections: { claims: [{ claim: "Partitions cap parallelism." }] } }
];

test("local saved-summary search ranks the best match first", () => {
  const results = searchHistory(history, "PostgreSQL composite index");
  assert.equal(results[0].id, "a");
});

test("empty query returns history without reordering", () => {
  assert.deepEqual(searchHistory(history, "  ").map((item) => item.id), ["a", "b"]);
});

test("search includes extracted concepts and claims", () => {
  const results = searchHistory(history, "partitions parallelism");
  assert.equal(results[0].id, "b");
});
