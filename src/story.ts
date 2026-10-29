import type { Letter } from "./letter.ts";
import type { Wrapped } from "./moments.ts";
import type { Personality } from "./personality.ts";

// Picks what each card shows. The page only draws what is in here, so a card
// with nothing worth saying is simply left out.

export interface StoryData {
  range: { from: string; to: string } | null;
  prompts: number;
  activeDays: number;
  sessions: number;
  topTypo: { spelling: string; word: string; count: number } | null;
  spellings: { word: string; spellings: string[] } | null;
  slip: { meant: string; hit: string; count: number } | null;
  topPrompts: { text: string; count: number }[];
  catchphrase: { text: string; sessions: number } | null;
  night: { latest: string; prompts: number } | null;
  streak: { days: number; from: string; to: string } | null;
  agents: { claude: number; codex: number; hours: number; bothDays: number } | null;
  money: { atLeastUsd: number; pricesAsOf: string } | null;
  talk: { nickname: { word: string; count: number } | null; please: number; thanks: number; checkIns: number } | null;
  work: { since: string; tests: number; commits: number; stops: number; languages: string[] } | null;
  personality: Personality;
  letter: Letter;
}

// Phrases everyone types; a catchphrase should sound like this person.
const PLAIN_OPENINGS = /^(let me|tell me|can you|could you|what we|then we|i want|i need|do you|is there|we have|we need)\b/;

export function pickCatchphrase(list: Wrapped["voice"]["catchphrases"]) {
  return list.find((c) => !PLAIN_OPENINGS.test(c.text)) ?? null;
}

// A count this small isn't a habit yet.
const HABIT = 20;

export function storyData(w: Wrapped, personality: Personality, letter: Letter): StoryData {
  const family = w.voice.typos.find((f) => f.spellings.length >= 5) ?? null;
  const streak = w.rhythm.longestStreak;
  const nickname = w.voice.nicknames[0] && w.voice.nicknames[0].count >= HABIT ? w.voice.nicknames[0] : null;
  const please = w.voice.lexicon.please ?? 0;
  const thanks = w.voice.lexicon.thanks ?? 0;
  const wk = w.work;
  return {
    range: w.totals.firstDay && w.totals.lastDay ? { from: w.totals.firstDay, to: w.totals.lastDay } : null,
    prompts: w.totals.prompts,
    activeDays: w.totals.activeDays,
    sessions: w.totals.sessions,
    topTypo: w.voice.topTypo && w.voice.topTypo.count >= 10 ? w.voice.topTypo : null,
    spellings: family ? { word: family.word, spellings: family.spellings.map((s) => s.spelling) } : null,
    slip: w.voice.keySlips.neighbours[0] && w.voice.keySlips.neighbours[0].count >= 10 ? w.voice.keySlips.neighbours[0] : null,
    topPrompts: w.voice.topPrompts.slice(0, 4),
    catchphrase: pickCatchphrase(w.voice.catchphrases),
    night: w.rhythm.lateNight.latest && w.rhythm.lateNight.prompts >= 5
      ? { latest: w.rhythm.lateNight.latest, prompts: w.rhythm.lateNight.prompts }
      : null,
    streak: streak && streak.days >= 5 ? streak : null,
    agents: w.totals.prompts
      ? {
          claude: w.loyalty.claudeShare,
          codex: w.loyalty.codexShare,
          hours: w.totals.agentHours,
          bothDays: w.loyalty.bothAgentDays,
        }
      : null,
    money: w.cost.atLeastUsd >= 1 ? { atLeastUsd: w.cost.atLeastUsd, pricesAsOf: w.cost.pricesAsOf } : null,
    talk:
      nickname || please + thanks >= HABIT || w.voice.checkIns >= HABIT
        ? { nickname, please, thanks, checkIns: w.voice.checkIns }
        : null,
    work:
      wk.since && wk.tests + wk.commits >= 10
        ? { since: wk.since, tests: wk.tests, commits: wk.commits, stops: wk.stops, languages: wk.languages.slice(0, 2).map((l) => l.name) }
        : null,
    personality,
    letter,
  };
}
