// Everything read from disk lands in a Harvest. A Harvest is private: it holds
// raw prompt text and never leaves the process. Only `share.ts` output is safe
// to show or export.

export type Agent = "claude" | "codex" | "cursor";
export const AGENTS: Agent[] = ["claude", "codex", "cursor"];

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

// Something an agent did, or a time it was stopped. Only the kind is kept, and
// for an edit the file's extension: never a command, a path or any output.
export interface Action {
  agent: Agent;
  at: Date;
  kind: CommandKind | "edit" | "stop";
  ext?: string; // ".py", for an edit
}

// Commands that run a project's tests, make a commit, push it, open a pull
// request, or put the work out: a deploy or a published package.
const COMMANDS = {
  test: /\b(pytest|vitest|jest|mocha|go test|cargo test|npm (run )?test|pnpm (run )?test|yarn test|bun test|node --test|tests?\.sh|phpunit|rspec)\b/,
  commit: /\bgit commit\b/,
  push: /\bgit push\b/,
  pr: /\b(gh pr create|glab mr create)\b/,
  deploy: /\b((npm|pnpm|yarn) publish|vercel (deploy )?--prod|netlify deploy|fly(ctl)? deploy|firebase deploy|wrangler (deploy|publish)|railway up|gcloud (run|app|functions) deploy|eas (submit|update)|cdk deploy|serverless deploy)\b/,
};
export type CommandKind = keyof typeof COMMANDS;

// Everything one command did: "git commit -m x && git push" is both.
export function commandKinds(command: string): CommandKind[] {
  return (Object.keys(COMMANDS) as CommandKind[]).filter((kind) => COMMANDS[kind].test(command));
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
  actions: Action[];
  coverage: Coverage[];
  // Folder, repo and org names from the logs. Never shown in a quote.
  privateNames: Set<string>;
}

export function emptyHarvest(): Harvest {
  return { prompts: [], usage: [], totals: [], turns: [], actions: [], coverage: [], privateNames: new Set() };
}

// Only what happened from `since` on. What each source covered is kept as read.
export function harvestSince(h: Harvest, since: Date): Harvest {
  const recent = <T extends { at: Date }>(list: T[]) => list.filter((x) => x.at >= since);
  return {
    ...h,
    prompts: recent(h.prompts),
    usage: recent(h.usage),
    totals: recent(h.totals),
    turns: recent(h.turns),
    actions: recent(h.actions),
  };
}

export function mergeHarvests(parts: Harvest[]): Harvest {
  const out = emptyHarvest();
  for (const p of parts) {
    out.prompts.push(...p.prompts);
    out.usage.push(...p.usage);
    out.totals.push(...p.totals);
    out.turns.push(...p.turns);
    out.actions.push(...p.actions);
    out.coverage.push(...p.coverage);
    for (const n of p.privateNames) out.privateNames.add(n);
  }
  return out;
}
