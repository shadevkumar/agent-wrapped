import { usageTokens, type TokenTotal, type Usage } from "./types.ts";

// What the same work would cost on the public API, in USD per million tokens.
// Standard tier, short context. Prices from the official pages, read 2026-10-28:
//   https://platform.claude.com/docs/en/about-claude/pricing
//   https://developers.openai.com/api/docs/pricing
// Long-context surcharges are not applied, so every figure here is a floor.
export const PRICES_AS_OF = "2026-10-28";

interface Price {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number;
  output: number;
}

const claude = (input: number, w5m: number, w1h: number, read: number, output: number): Price => ({
  input,
  cacheRead: read,
  cacheWrite: w5m,
  cacheWrite1h: w1h,
  output,
});
// OpenAI doesn't charge extra to write the cache.
const openai = (input: number, cached: number, output: number): Price => ({
  input,
  cacheRead: cached,
  cacheWrite: input,
  cacheWrite1h: input,
  output,
});

// Matched by prefix, so dated ids like claude-opus-4-5-20251101 find their row.
const PRICES: [string, Price][] = [
  ["claude-fable-5-1", claude(10, 12.5, 20, 0.25, 50)],
  ["claude-fable-5", claude(10, 12.5, 20, 1, 50)],
  ["claude-opus-5-5", claude(4, 5, 8, 0.2, 20)],
  ["claude-opus-5", claude(5, 6.25, 10, 0.5, 25)],
  ["claude-opus-4-8", claude(5, 6.25, 10, 0.5, 25)],
  ["claude-opus-4-7", claude(5, 6.25, 10, 0.5, 25)],
  ["claude-opus-4-6", claude(5, 6.25, 10, 0.5, 25)],
  ["claude-opus-4-5", claude(5, 6.25, 10, 0.5, 25)],
  ["claude-sonnet-5-5", claude(2, 2.5, 4, 0.1, 10)],
  ["claude-sonnet-5", claude(2, 2.5, 4, 0.2, 10)],
  ["claude-sonnet-4-6", claude(3, 3.75, 6, 0.3, 15)],
  ["claude-sonnet-4-5", claude(3, 3.75, 6, 0.3, 15)],
  ["claude-haiku-5-5", claude(0.1, 0.125, 0.2, 0.01, 0.5)],
  ["claude-haiku-4-5", claude(1, 1.25, 2, 0.1, 5)],
  ["gpt-6-astra", openai(10, 1, 50)],
  ["gpt-6.1-sol", openai(2, 0.1, 10)],
  ["gpt-6.1-terra", openai(1, 0.05, 5)],
  ["gpt-6-sol", openai(2, 0.2, 10)],
  ["gpt-6-luna", openai(0.1, 0.01, 0.5)],
  ["gpt-5.6-sol", openai(4, 0.4, 20)], // promotional price, at least until 2026-11-21
  ["gpt-5.6-terra", openai(2, 0.2, 12)],
  ["gpt-5.6-luna", openai(0.2, 0.02, 1.2)],
  ["gpt-5.5", openai(5, 0.5, 30)],
  ["gpt-5.4", openai(2.5, 0.25, 15)],
];

export function priceFor(model: string): Price | null {
  // Longest prefix first, so "claude-opus-5-5" wins over "claude-opus-5".
  const hit = [...PRICES]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => model === prefix || model.startsWith(prefix + "-"));
  return hit ? hit[1] : null;
}

export interface Cost {
  // Tokens with a full split, priced exactly at standard rates.
  exactUsd: number;
  exactTokens: number;
  // Tokens known only as a total, priced as if all were the cheapest kind
  // (cache reads). The true cost is higher, so `atLeastUsd` stays true.
  floorUsd: number;
  floorTokens: number;
  // Tokens from models with no known price. Counted, never priced.
  unpricedTokens: number;
  unpricedModels: string[];
  atLeastUsd: number;
}

export function apiCost(usage: Usage[], totals: TokenTotal[]): Cost {
  const c: Cost = {
    exactUsd: 0,
    exactTokens: 0,
    floorUsd: 0,
    floorTokens: 0,
    unpricedTokens: 0,
    unpricedModels: [],
    atLeastUsd: 0,
  };
  const unpriced = new Set<string>();
  for (const u of usage) {
    const p = priceFor(u.model);
    if (!p) {
      c.unpricedTokens += usageTokens(u);
      unpriced.add(u.model);
      continue;
    }
    c.exactTokens += usageTokens(u);
    c.exactUsd +=
      (u.input * p.input +
        u.cacheRead * p.cacheRead +
        u.cacheWrite * p.cacheWrite +
        u.cacheWrite1h * p.cacheWrite1h +
        u.output * p.output) /
      1e6;
  }
  for (const t of totals) {
    const p = priceFor(t.model);
    if (!p) {
      c.unpricedTokens += t.tokens;
      unpriced.add(t.model);
      continue;
    }
    c.floorTokens += t.tokens;
    c.floorUsd += (t.tokens * p.cacheRead) / 1e6;
  }
  c.unpricedModels = [...unpriced].sort();
  c.atLeastUsd = c.exactUsd + c.floorUsd;
  return c;
}
