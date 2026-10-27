import assert from "node:assert/strict";
import { test } from "node:test";
import { apiCost, priceFor } from "../src/pricing.ts";
import type { Usage } from "../src/types.ts";

const at = new Date("2026-10-01T00:00:00Z");
const usage = (model: string, u: Partial<Usage>): Usage => ({
  agent: "claude",
  model,
  at,
  input: 0,
  cacheRead: 0,
  cacheWrite: 0,
  cacheWrite1h: 0,
  output: 0,
  ...u,
});

test("the longest matching model name wins, and dated ids still match", () => {
  assert.equal(priceFor("claude-opus-5-5")?.input, 4);
  assert.equal(priceFor("claude-opus-5")?.input, 5);
  assert.equal(priceFor("claude-opus-4-5-20251101")?.input, 5);
  assert.equal(priceFor("gpt-6.1-sol")?.cacheRead, 0.1);
  assert.equal(priceFor("gpt-6-sol")?.cacheRead, 0.2);
  assert.equal(priceFor("claude-opus-55"), null);
});

test("exact cost prices every kind of token at its own rate", () => {
  // Opus 5.5: $4 in, $0.20 read, $5 write 5m, $8 write 1h, $20 out (per million)
  const c = apiCost(
    [usage("claude-opus-5-5", { input: 1e6, cacheRead: 1e6, cacheWrite: 1e6, cacheWrite1h: 1e6, output: 1e6 })],
    [],
  );
  assert.equal(Math.round(c.exactUsd * 100) / 100, 37.2);
});

test("totals without a split count only at the cheapest rate, unknown models not at all", () => {
  const c = apiCost(
    [usage("mystery-model", { input: 500 })],
    [
      { agent: "codex", model: "gpt-5.5", at, tokens: 2e6 }, // $0.50 cached rate
      { agent: "codex", model: "gpt-5.2-codex", at, tokens: 1e6 },
    ],
  );
  assert.equal(c.floorUsd, 1);
  assert.equal(c.atLeastUsd, 1);
  assert.equal(c.unpricedTokens, 1e6 + 500);
  assert.deepEqual(c.unpricedModels, ["gpt-5.2-codex", "mystery-model"]);
});
