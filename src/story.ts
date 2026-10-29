import { plainName } from "./chapters.ts";
import type { Letter, Span } from "./letter.ts";
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
  spellings: { word: string; spellings: string[]; ways: number } | null; // ways: every spelling, and the right one
  slip: { meant: string; hit: string; count: number } | null;
  topPrompts: { text: string; count: number }[];
  catchphrase: { text: string; sessions: number } | null;
  night: { latest: string; prompts: number } | null;
  streak: { days: number; from: string; to: string } | null;
  // Links shared before Cursor was read have no `cursor`.
  agents: { claude: number; codex: number; cursor?: number; hours: number; bothDays: number } | null;
  money: { atLeastUsd: number; pricesAsOf: string } | null;
  talk: { nickname: { word: string; count: number } | null; please: number; thanks: number; checkIns: number } | null;
  work: { since: string; tests: number; commits: number; stops: number; languages: string[] } | null;
  shipped: {
    since: string;
    pushes: number;
    prs: number;
    deploys: number;
    biggestWeek: { from: string; to: string; commits: number } | null;
  } | null;
  chapters: { from: string; to: string; name: string }[] | null; // months like "2026-03"
  personality: Personality;
  letter: Letter;
  period: Span | null; // "month" when made with --last-month; older stories and links have none
}

// Phrases everyone types; a catchphrase should sound like this person.
const PLAIN_OPENINGS = /^(let me|tell me|can you|could you|what we|then we|i want|i need|do you|is there|we have|we need)\b/;

export function pickCatchphrase(list: Wrapped["voice"]["catchphrases"]) {
  return list.find((c) => !PLAIN_OPENINGS.test(c.text)) ?? null;
}

const SPELLINGS_SHOWN = 16;
// Pushes, pull requests and deploys together, before they make a card.
const SHIPPED = 5;

// A count this small isn't a habit yet.
const HABIT = 20;

// `chapterNames` come from `nameChapters`; without them a chapter is named by its top words.
export function storyData(
  w: Wrapped,
  personality: Personality,
  letter: Letter,
  chapterNames = w.chapters.map((c) => plainName(c.words)),
  span: Span = "year",
): StoryData {
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
    // The card flashes the most common few; more would only make links longer.
    spellings: family ? { word: family.word, spellings: family.spellings.slice(0, SPELLINGS_SHOWN).map((s) => s.spelling), ways: family.spellings.length + 1 } : null,
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
          cursor: w.loyalty.cursorShare,
          hours: w.totals.agentHours,
          bothDays: w.loyalty.bothAgentDays,
        }
      : null,
    money: w.cost.atLeastUsd >= 1 ? { atLeastUsd: Math.round(w.cost.atLeastUsd), pricesAsOf: w.cost.pricesAsOf } : null,
    talk:
      nickname || please + thanks >= HABIT || w.voice.checkIns >= HABIT
        ? { nickname, please, thanks, checkIns: w.voice.checkIns }
        : null,
    work:
      wk.since && wk.tests + wk.commits >= 10
        ? { since: wk.since, tests: wk.tests, commits: wk.commits, stops: wk.stops, languages: wk.languages.slice(0, 2).map((l) => l.name) }
        : null,
    shipped:
      wk.since && wk.pushes + wk.prs + wk.deploys >= SHIPPED
        ? { since: wk.since, pushes: wk.pushes, prs: wk.prs, deploys: wk.deploys, biggestWeek: wk.biggestWeek && wk.biggestWeek.commits >= 5 ? wk.biggestWeek : null }
        : null,
    chapters: w.chapters.length >= 3 ? w.chapters.map((c, i) => ({ from: c.from, to: c.to, name: chapterNames[i]! })) : null,
    personality,
    letter,
    period: span,
  };
}
