// Everything read from disk lands in a Harvest. A Harvest is private: it holds
// raw prompt text and never leaves the process. Only `share.ts` output is safe
// to show or export.

export type Agent = "claude" | "codex";

export interface Prompt {
  agent: Agent;
  text: string;
  at: Date;
  session: string;
}

// Token usage with a full split, so it can be priced.
// `input` excludes cached tokens on both agents. `cacheWrite` is the
// 5-minute kind (or unknown); `cacheWrite1h` costs more.
export interface Usage {
  agent: Agent;
  model: string;
  at: Date;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h: number;
  output: number;
}

export function usageTokens(u: Usage): number {
  return u.input + u.cacheRead + u.cacheWrite + u.cacheWrite1h + u.output;
}

// Tokens known only as one total (older Codex threads). Counted, never priced.
export interface TokenTotal {
  agent: Agent;
  model: string;
  at: Date;
  tokens: number;
}

// One stretch of the agent working on a request.
export interface Turn {
  agent: Agent;
  at: Date;
  durationMs: number;
}

// What each source covered, so the story can be honest about gaps.
export interface Coverage {
  agent: Agent;
  source: string;
  count: number;
  from: Date | null;
  to: Date | null;
}

export interface Harvest {
  prompts: Prompt[];
  usage: Usage[];
  totals: TokenTotal[];
  turns: Turn[];
  coverage: Coverage[];
  // Folder, repo and org names from the logs. Never shown in a quote.
  privateNames: Set<string>;
}

export function emptyHarvest(): Harvest {
  return { prompts: [], usage: [], totals: [], turns: [], coverage: [], privateNames: new Set() };
}

export function mergeHarvests(parts: Harvest[]): Harvest {
  const out = emptyHarvest();
  for (const p of parts) {
    out.prompts.push(...p.prompts);
    out.usage.push(...p.usage);
    out.totals.push(...p.totals);
    out.turns.push(...p.turns);
    out.coverage.push(...p.coverage);
    for (const n of p.privateNames) out.privateNames.add(n);
  }
  return out;
}
