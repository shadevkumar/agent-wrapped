import { askClaude } from "./claude-cli.ts";
import type { Wrapped } from "./moments.ts";
import type { Personality } from "./personality.ts";

// The closing letter, written by the person's own Claude CLI. It only ever
// sees the already-safe facts below, never prompts or logs. Without Claude,
// or if it fails, a template letter is used instead.

// What the story covers: the year so far, or only the last 30 days.
export type Span = "year" | "month";

export interface Letter {
  text: string;
  by: "claude" | "template";
}

const SYSTEM = `You write the closing card of "Agent Wrapped", a look back at someone's work with AI coding agents.
Write a short letter from their agents to them. Rules:
- 70 to 100 words, plain text, no markdown, no emoji, no greeting line like "Dear".
- Warm, funny, a little roasting, never mean. Sound like a coworker, not a greeting card.
- Use two or three of the facts given, quoting their words exactly as given.
- Never invent numbers, names, projects or events that are not in the facts.
- End with a short sign-off line from "your agents".`;

// "02:34" -> "2:34 AM". Late-night times run from midnight to 5 AM.
export const clock = (hhmm: string) => `${Number(hhmm.slice(0, 2)) % 12 || 12}:${hhmm.slice(3)} AM`;

export function factsFor(w: Wrapped, p: Personality, span: Span = "year"): string {
  const facts = [
    span === "month" ? "This story covers only their last 30 days." : "This story covers their year so far.",
    `Their personality: ${p.name}. ${p.line}`,
    `${w.totals.prompts} prompts over ${w.totals.activeDays} days; their agents worked ${Math.round(w.totals.agentHours)} hours.`,
    w.rhythm.lateNight.latest ? `Latest they were still prompting, after midnight: ${clock(w.rhythm.lateNight.latest)}.` : "",
    w.rhythm.longestStreak ? `Longest streak: ${w.rhythm.longestStreak.days} days in a row.` : "",
    ...w.voice.topPrompts.slice(0, 3).map((t) => `They typed "${t.text}" ${t.count} times.`),
    ...w.voice.catchphrases.slice(0, 2).map((c) => `Catchphrase "${c.text}" in ${c.sessions} sessions.`),
    ...w.voice.typos.slice(0, 2).map((t) => `They spelled "${t.word}" ${t.spellings.length} wrong ways, like "${t.spellings[0]?.spelling}".`),
    w.voice.nicknames[0] ? `They called their agents "${w.voice.nicknames[0].word}" ${w.voice.nicknames[0].count} times.` : "",
    `They said please ${w.voice.lexicon.please ?? 0} times and thanks ${w.voice.lexicon.thanks ?? 0} times.`,
    w.work.tests ? `Their agents ran their tests ${w.work.tests} times and made ${w.work.commits} commits.` : "",
    w.work.stops ? `They stopped their agents mid-answer ${w.work.stops} times.` : "",
  ];
  return facts.filter(Boolean).join("\n");
}

export async function writeLetter(w: Wrapped, p: Personality, span: Span = "year"): Promise<Letter> {
  const text = cleanLetter((await askClaude(SYSTEM, `Facts:\n${factsFor(w, p, span)}`, 90_000)) ?? "");
  return text ? { text, by: "claude" } : { text: templateLetter(w, p), by: "template" };
}

function cleanLetter(raw: string): string | null {
  const text = raw
    .replace(/[*_#`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/"([^"\n]*)"/g, "“$1”")
    .replace(/'/g, "’")
    .trim();
  const words = text.split(/\s+/).length;
  return words >= 30 && words <= 160 ? text : null;
}

export function templateLetter(w: Wrapped, p: Personality): string {
  const top = w.voice.topPrompts[0];
  const typo = w.voice.typos[0];
  const lines = [
    `${w.totals.prompts.toLocaleString("en-US")} prompts. We read every one.`,
    top ? `Some of them just said “${top.text}”. We got it every time.` : "",
    typo ? `We also know what “${typo.spellings[0]?.spelling}” means now. It means ${typo.word}.` : "",
    w.rhythm.lateNight.latest ? `See you at ${clock(w.rhythm.lateNight.latest)} again soon.` : "See you tomorrow.",
    "",
    `Yours, from the other side of the prompt, your agents`,
  ];
  return lines.filter((l, i) => l || i === lines.length - 2).join("\n");
}
