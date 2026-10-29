import type { Wrapped } from "./moments.ts";

// One personality per person, picked from how they really work. Each trait
// scores its signal against a typical level; the strongest trait wins.

export interface Personality {
  id: string;
  name: string;
  line: string; // one sentence, built from their own numbers
  traits: string[]; // the next strongest, for the summary card
}

interface Trait {
  id: string;
  name: string;
  score: (w: Wrapped) => number;
  line: (w: Wrapped) => string;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");

// The two agents you used most, most first.
function topTwo(w: Wrapped) {
  const { claudeShare, codexShare, cursorShare } = w.loyalty;
  return [{ name: "Claude", share: claudeShare }, { name: "Codex", share: codexShare }, { name: "Cursor", share: cursorShare }]
    .sort((x, y) => y.share - x.share)
    .slice(0, 2);
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const perPrompt = (w: Wrapped, count: number) => (w.totals.prompts ? count / w.totals.prompts : 0);

const TRAITS: Trait[] = [
  {
    id: "midnight-foreman",
    name: "The Midnight Foreman",
    score: (w) => w.rhythm.lateNight.share / 0.08,
    line: (w) =>
      `You gave ${n(w.rhythm.lateNight.prompts)} orders after midnight, and your agents kept working while the city slept.`,
  },
  {
    id: "one-word-director",
    name: "The One-Word Director",
    score: (w) => w.voice.shortShare / 0.25,
    line: (w) => `${pct(w.voice.shortShare)} of your prompts were three words or fewer. Your agents learned to read minds.`,
  },
  {
    id: "copy-paste-architect",
    name: "The Copy-Paste Architect",
    score: (w) => w.voice.pastedShare / 0.15,
    line: (w) => `${pct(w.voice.pastedShare)} of your prompts reused text you had pasted before. You don't repeat yourself. You reuse yourself.`,
  },
  {
    id: "fast-fingers",
    name: "Fast Fingers",
    score: (w) => (perPrompt(w, w.voice.typoCount) * 100) / 15,
    line: (w) => `${n(w.voice.typoCount)} typos and your agents understood every one. Speed over spelling.`,
  },
  {
    id: "polite-commander",
    name: "The Polite Commander",
    score: (w) => perPrompt(w, (w.voice.lexicon.please ?? 0) + (w.voice.lexicon.thanks ?? 0)) / 0.15,
    line: (w) => `You said please ${n(w.voice.lexicon.please ?? 0)} times. When the machines rise, they will remember you kindly.`,
  },
  {
    id: "interrogator",
    name: "The Interrogator",
    score: (w) => perPrompt(w, (w.voice.lexicon.why ?? 0) + (w.voice.lexicon.again ?? 0)) / 0.15,
    line: (w) => `You asked why ${n(w.voice.lexicon.why ?? 0)} times. No answer went unchecked.`,
  },
  {
    id: "marathoner",
    name: "The Marathoner",
    score: (w) => (w.rhythm.longestStreak?.days ?? 0) / 21,
    line: (w) => `${w.rhythm.longestStreak?.days ?? 0} days in a row without a single day off from your agents.`,
  },
  {
    id: "two-timer",
    name: "The Two-Timer",
    score: (w) => (topTwo(w)[1]?.share ?? 0) / 0.35,
    line: (w) => {
      const [a, b] = topTwo(w);
      return `${a!.name} and ${b!.name} both on ${n(w.loyalty.bothAgentDays)} days. Neither of them knows about the other.`;
    },
  },
];

export function pickPersonality(w: Wrapped): Personality {
  const ranked = TRAITS.map((t) => ({ t, s: t.score(w) }))
    .filter((x) => Number.isFinite(x.s))
    .sort((a, b) => b.s - a.s);
  const top = ranked[0]!.t;
  return {
    id: top.id,
    name: top.name,
    line: top.line(w),
    traits: ranked.slice(1, 3).filter((x) => x.s >= 1).map((x) => x.t.name),
  };
}
