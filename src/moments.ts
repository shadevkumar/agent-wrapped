import { localDay } from "./files.ts";
import { apiCost, PRICES_AS_OF, type Cost } from "./pricing.ts";
import { usageTokens, type Agent, type Harvest, type Prompt } from "./types.ts";
import { findTypos, keySlips, tokenize, Words, type KeySlips, type TypoFamily } from "./words.ts";

// The shareable result. Every string in here came through `Words.safeQuote`
// or is a number, a date, a model name or a word list we wrote ourselves.

export interface Wrapped {
  coverage: { agent: Agent; source: string; count: number; from: string | null; to: string | null }[];
  totals: {
    prompts: number;
    sessions: number;
    activeDays: number;
    firstDay: string | null;
    lastDay: string | null;
    agentHours: number;
    tokens: number;
  };
  agents: Record<Agent, AgentStats>;
  cost: Cost & { pricesAsOf: string };
  rhythm: {
    byHour: number[];
    byWeekday: number[]; // Sunday first
    busiestDay: { day: string; prompts: number } | null;
    longestStreak: { days: number; from: string; to: string } | null;
    lateNight: { prompts: number; share: number; latest: string | null };
  };
  voice: {
    topPrompts: { text: string; count: number }[];
    catchphrases: { text: string; sessions: number }[];
    typos: TypoFamily[];
    typoCount: number; // every mistyped word, all families
    topTypo: { spelling: string; word: string; count: number } | null;
    keySlips: KeySlips;
    shortShare: number; // prompts of three words or fewer
    medianWords: number;
    pastedShare: number; // prompts that include text pasted into other prompts
    doubleSends: number;
    lexicon: Record<string, number>;
    nicknames: { word: string; count: number }[]; // what you call your agent, most first
    checkIns: number; // prompts asking "okay?" or "right?"
  };
  loyalty: { claudeShare: number; codexShare: number; bothAgentDays: number };
  // What the agents did. The logs keep this for less time than prompts.
  work: {
    since: string | null;
    tests: number;
    commits: number;
    edits: number;
    stops: number; // times you stopped an agent mid-answer
    languages: { name: string; edits: number }[];
  };
}

export interface AgentStats {
  prompts: number;
  sessions: number;
  tokens: number;
  agentHours: number;
  longestTurnMinutes: number;
  models: { model: string; tokens: number }[];
}

const LATE_NIGHT_END_HOUR = 5;
// Repeats under a second apart are the logs writing a message twice, not a person.
const DOUBLE_SEND_MIN_MS = 1_000;
const DOUBLE_SEND_MAX_MS = 120_000;
// The same ten words in a row in three or more prompts is pasted text, not habit.
const PASTE_WINDOW = 10;
const PASTE_MIN_PROMPTS = 3;

const LEXICON: Record<string, string[]> = {
  okay: ["okay", "ok"],
  please: ["please", "pls", "plz"],
  thanks: ["thanks", "thank", "thx"],
  sorry: ["sorry"],
  bro: ["bro", "dude", "man"],
  why: ["why"],
  again: ["again"],
  wait: ["wait"],
  perfect: ["perfect", "great", "awesome", "nice"],
};

const NICKNAMES = ["dude", "bro", "man", "buddy", "mate", "bhai", "boss", "chief", "fam"];
const CHECK_IN = /\b(okay|ok|right)\s*\?/i;

// File types that are code, by the language they're written in.
const LANGUAGES: Record<string, string> = {
  ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".mjs": "JavaScript", ".cjs": "JavaScript", ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".java": "Java",
  ".kt": "Kotlin", ".swift": "Swift", ".c": "C", ".h": "C", ".cpp": "C++", ".cc": "C++", ".hpp": "C++",
  ".cs": "C#", ".php": "PHP", ".dart": "Dart", ".scala": "Scala", ".ex": "Elixir", ".exs": "Elixir",
  ".lua": "Lua", ".sql": "SQL", ".sh": "Shell", ".css": "CSS", ".scss": "CSS", ".html": "HTML",
  ".vue": "Vue", ".svelte": "Svelte",
};

export function computeWrapped(h: Harvest, words = new Words(h.privateNames)): Wrapped {
  const prompts = [...h.prompts].sort((a, b) => a.at.getTime() - b.at.getTime());
  const tokenized = prompts.map((p) => tokenize(p.text));

  const counts = new Map<string, number>();
  for (const toks of tokenized) for (const w of toks) counts.set(w, (counts.get(w) ?? 0) + 1);
  const { families, canonical } = findTypos(counts, words);
  const canon = (toks: string[]) => toks.map((w) => canonical.get(w) ?? w);
  const canonPrompts = tokenized.map(canon);
  const pasted = pastedTokens(canonPrompts);
  const lengths = tokenized.map((t) => t.length).sort((a, b) => a - b);

  const days = [...new Set(prompts.map((p) => localDay(p.at)))].sort();
  const cost = apiCost(h.usage, h.totals);
  const agents = { claude: agentStats("claude", h), codex: agentStats("codex", h) };

  return {
    coverage: h.coverage.map((c) => ({
      agent: c.agent,
      source: c.source,
      count: c.count,
      from: c.from ? localDay(c.from) : null,
      to: c.to ? localDay(c.to) : null,
    })),
    totals: {
      prompts: prompts.length,
      sessions: agents.claude.sessions + agents.codex.sessions,
      activeDays: days.length,
      firstDay: days[0] ?? null,
      lastDay: days.at(-1) ?? null,
      agentHours: round(agents.claude.agentHours + agents.codex.agentHours, 1),
      tokens: agents.claude.tokens + agents.codex.tokens,
    },
    agents,
    cost: { ...cost, pricesAsOf: PRICES_AS_OF },
    rhythm: rhythm(prompts, days),
    voice: {
      topPrompts: topPrompts(canonPrompts, words, canonical),
      catchphrases: catchphrases(prompts, canonPrompts, pasted, words, canonical),
      typos: families.slice(0, 10),
      typoCount: families.reduce((s, f) => s + f.total, 0),
      topTypo: topTypo(families),
      keySlips: keySlips(families),
      shortShare: share(tokenized.filter((t) => t.length > 0 && t.length <= 3).length, prompts.length),
      medianWords: lengths[Math.floor(lengths.length / 2)] ?? 0,
      pastedShare: share(pasted.filter((flags) => flags.some(Boolean)).length, prompts.length),
      doubleSends: doubleSends(prompts),
      lexicon: lexicon(tokenized),
      nicknames: nicknames(tokenized),
      checkIns: prompts.filter((p) => CHECK_IN.test(p.text)).length,
    },
    loyalty: {
      claudeShare: share(agents.claude.prompts, prompts.length),
      codexShare: share(agents.codex.prompts, prompts.length),
      bothAgentDays: bothAgentDays(prompts),
    },
    work: work(h),
  };
}

function nicknames(tokenized: string[][]): { word: string; count: number }[] {
  const counts = new Map(NICKNAMES.map((w) => [w, 0]));
  for (const toks of tokenized) for (const w of toks) if (counts.has(w)) counts.set(w, counts.get(w)! + 1);
  return [...counts].filter(([, n]) => n > 0).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count);
}

function work(h: Harvest): Wrapped["work"] {
  const count = (kind: string) => h.actions.filter((a) => a.kind === kind).length;
  const byLanguage = new Map<string, number>();
  for (const a of h.actions) {
    const name = a.kind === "edit" && a.ext ? LANGUAGES[a.ext] : undefined;
    if (name) byLanguage.set(name, (byLanguage.get(name) ?? 0) + 1);
  }
  // Stops are kept far longer than the rest, so they don't move the start.
  const first = h.actions.reduce<Date | null>((min, a) => (a.kind !== "stop" && (!min || a.at < min) ? a.at : min), null);
  return {
    since: first ? localDay(first) : null,
    tests: count("test"),
    commits: count("commit"),
    edits: count("edit"),
    stops: count("stop"),
    languages: [...byLanguage].map(([name, edits]) => ({ name, edits })).sort((a, b) => b.edits - a.edits),
  };
}

function agentStats(agent: Agent, h: Harvest): AgentStats {
  const prompts = h.prompts.filter((p) => p.agent === agent);
  const turns = h.turns.filter((t) => t.agent === agent);
  const byModel = new Map<string, number>();
  for (const u of h.usage) if (u.agent === agent) byModel.set(u.model, (byModel.get(u.model) ?? 0) + usageTokens(u));
  for (const t of h.totals) if (t.agent === agent) byModel.set(t.model, (byModel.get(t.model) ?? 0) + t.tokens);
  const models = [...byModel].map(([model, tokens]) => ({ model, tokens })).sort((a, b) => b.tokens - a.tokens);
  return {
    prompts: prompts.length,
    sessions: new Set(prompts.map((p) => p.session)).size,
    tokens: models.reduce((s, m) => s + m.tokens, 0),
    agentHours: round(turns.reduce((s, t) => s + t.durationMs, 0) / 3_600_000, 1),
    longestTurnMinutes: round(Math.max(0, ...turns.map((t) => t.durationMs)) / 60_000, 1),
    models,
  };
}

function rhythm(prompts: Prompt[], days: string[]): Wrapped["rhythm"] {
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const perDay = new Map<string, number>();
  let late = 0;
  let latestMinute = -1;
  for (const p of prompts) {
    const hour = p.at.getHours();
    byHour[hour]!++;
    byWeekday[p.at.getDay()]!++;
    const day = localDay(p.at);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    if (hour < LATE_NIGHT_END_HOUR) {
      late++;
      latestMinute = Math.max(latestMinute, hour * 60 + p.at.getMinutes());
    }
  }
  const busiest = [...perDay].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    byHour,
    byWeekday,
    busiestDay: busiest ? { day: busiest[0], prompts: busiest[1] } : null,
    longestStreak: longestStreak(days),
    lateNight: {
      prompts: late,
      share: share(late, prompts.length),
      latest: latestMinute < 0 ? null : `${pad(Math.floor(latestMinute / 60))}:${pad(latestMinute % 60)}`,
    },
  };
}

// `days` are sorted, unique local days (YYYY-MM-DD).
export function longestStreak(days: string[]): { days: number; from: string; to: string } | null {
  if (days.length === 0) return null;
  let best = { days: 1, from: days[0]!, to: days[0]! };
  let run = { days: 1, from: days[0]! };
  for (let i = 1; i < days.length; i++) {
    const gap = (Date.parse(days[i]!) - Date.parse(days[i - 1]!)) / 86_400_000;
    run = gap === 1 ? { days: run.days + 1, from: run.from } : { days: 1, from: days[i]! };
    if (run.days > best.days) best = { days: run.days, from: run.from, to: days[i]! };
  }
  return best;
}

function topPrompts(canonPrompts: string[][], words: Words, typos: Map<string, string>) {
  const counts = new Map<string, number>();
  for (const toks of canonPrompts) {
    if (toks.length === 0 || toks.length > 6) continue;
    const key = toks.join(" ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .flatMap(([text, count]) => {
      const safe = words.safeQuote(text, typos);
      return safe ? [{ text: safe, count }] : [];
    })
    .slice(0, 8);
}

// For each prompt, which words belong to text that was pasted into other prompts.
export function pastedTokens(canonPrompts: string[][]): boolean[][] {
  const windowsPerPrompt = canonPrompts.map((toks) => {
    const set = new Set<string>();
    for (let s = 0; s + PASTE_WINDOW <= toks.length; s++) set.add(toks.slice(s, s + PASTE_WINDOW).join(" "));
    return set;
  });
  const seenIn = new Map<string, number>();
  for (const set of windowsPerPrompt) for (const w of set) seenIn.set(w, (seenIn.get(w) ?? 0) + 1);
  return canonPrompts.map((toks) => {
    const flags = new Array<boolean>(toks.length).fill(false);
    for (let s = 0; s + PASTE_WINDOW <= toks.length; s++) {
      if ((seenIn.get(toks.slice(s, s + PASTE_WINDOW).join(" ")) ?? 0) >= PASTE_MIN_PROMPTS) {
        flags.fill(true, s, s + PASTE_WINDOW);
      }
    }
    return flags;
  });
}

// Phrases of 3-5 words typed in at least three different sessions. Pasted text
// doesn't count. A longer phrase replaces a shorter one inside it when it
// explains most of its uses.
function catchphrases(
  prompts: Prompt[],
  canonPrompts: string[][],
  pasted: boolean[][],
  words: Words,
  typos: Map<string, string>,
) {
  const grams = new Map<string, { n: number; sessions: Set<string>; uses: number }>();
  canonPrompts.forEach((toks, i) => {
    const seen = new Set<string>();
    for (let n = 3; n <= 5; n++) {
      for (let s = 0; s + n <= toks.length; s++) {
        if (pasted[i]!.slice(s, s + n).some(Boolean)) continue;
        const g = toks.slice(s, s + n);
        if (words.isStopword(g[0]!) || words.isStopword(g.at(-1)!)) continue;
        const key = g.join(" ");
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = grams.get(key) ?? { n, sessions: new Set(), uses: 0 };
        entry.sessions.add(`${prompts[i]!.agent}:${prompts[i]!.session}`);
        entry.uses++;
        grams.set(key, entry);
      }
    }
  });
  const candidates = [...grams]
    .filter(([, g]) => g.sessions.size >= 3 && g.uses >= 4)
    .sort((a, b) => b[1].n - a[1].n);
  const kept: [string, number][] = [];
  for (const [text, g] of candidates) {
    const covered = kept.some(([longer, sessions]) => ` ${longer} `.includes(` ${text} `) && sessions >= g.sessions.size * 0.8);
    if (!covered) kept.push([text, g.sessions.size]);
  }
  return kept
    .sort((a, b) => b[1] - a[1])
    .flatMap(([text, sessions]) => {
      const safe = words.safeQuote(text, typos);
      return safe ? [{ text: safe, sessions }] : [];
    })
    .slice(0, 10);
}

function topTypo(families: TypoFamily[]): Wrapped["voice"]["topTypo"] {
  let best: Wrapped["voice"]["topTypo"] = null;
  for (const f of families) {
    for (const s of f.spellings) if (!best || s.count > best.count) best = { spelling: s.spelling, word: f.word, count: s.count };
  }
  return best;
}

// The same message sent again in the same session within two minutes.
export function doubleSends(sorted: Prompt[]): number {
  const last = new Map<string, Prompt>();
  let count = 0;
  for (const p of sorted) {
    const key = `${p.agent}:${p.session}`;
    const prev = last.get(key);
    const gap = prev ? p.at.getTime() - prev.at.getTime() : -1;
    if (prev && prev.text.trim() === p.text.trim() && gap >= DOUBLE_SEND_MIN_MS && gap <= DOUBLE_SEND_MAX_MS) {
      count++;
    }
    last.set(key, p);
  }
  return count;
}

function lexicon(tokenized: string[][]): Record<string, number> {
  const out: Record<string, number> = {};
  const lookup = new Map<string, string>();
  for (const [group, list] of Object.entries(LEXICON)) {
    out[group] = 0;
    for (const w of list) lookup.set(w, group);
  }
  for (const toks of tokenized) {
    for (const w of toks) {
      const group = lookup.get(w);
      if (group) out[group]!++;
    }
  }
  return out;
}

function bothAgentDays(prompts: Prompt[]): number {
  const byDay = new Map<string, Set<Agent>>();
  for (const p of prompts) {
    const day = localDay(p.at);
    const set = byDay.get(day) ?? new Set();
    set.add(p.agent);
    byDay.set(day, set);
  }
  return [...byDay.values()].filter((s) => s.size === 2).length;
}

function share(part: number, whole: number): number {
  return whole ? round(part / whole, 3) : 0;
}

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
