import { askClaude } from "./claude-cli.ts";
import type { Wrapped } from "./moments.ts";
import { tokenize, type Words } from "./words.ts";

// Names each chapter of the year. The person's own `claude` command gets only
// each chapter's standout words, which already passed the topic-word check,
// never a prompt. A name it writes is used only if every word in it passes
// that same check or is one of the chapter's words; otherwise, and with no
// AI, the chapter is named by its top words.

const SYSTEM = `You name the chapters of someone's year working with AI coding agents.
For each chapter you get the words that set it apart. Write a short name for what they seemed to work on.
Rules:
- 2 to 5 words and at most 45 characters, lowercase except the first letter, no punctuation at the end.
- Use the given words and plain everyday words only. No names of people, companies, products or places.
- Describe the work, not the person. Don't guess beyond the words.
- Reply with a JSON array of strings only, one per chapter, in the same order.`;

export function plainName(words: string[]): string {
  return words.slice(0, 3).join(" · ");
}

export async function nameChapters(chapters: Wrapped["chapters"], words: Words, useAi: boolean): Promise<string[]> {
  const plain = chapters.map((c) => plainName(c.words));
  if (!useAi || chapters.length === 0) return plain;
  const reply = await askClaude(SYSTEM, chapters.map((c, i) => `Chapter ${i + 1}: ${c.words.join(", ")}`).join("\n"), 60_000);
  const named = reply ? parseNames(reply, chapters.length) : null;
  return plain.map((fallback, i) => (named && safeName(named[i]!, chapters[i]!.words, words)) || fallback);
}

export function parseNames(raw: string, count: number): string[] | null {
  try {
    const list = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    return Array.isArray(list) && list.length === count && list.every((n) => typeof n === "string") ? list : null;
  } catch {
    return null;
  }
}

// The name, tidied, if every word in it is safe to show; otherwise null.
export function safeName(name: string, chapterWords: string[], words: Words): string | null {
  const text = name.trim().replace(/[.!]+$/, "");
  const parts = tokenize(text);
  // Longer names don't fit a row of the card.
  if (parts.length < 2 || parts.length > 6 || text.length > 48) return null;
  if (/[^A-Za-z '\-]/.test(text)) return null;
  const ok = parts.every((w) => chapterWords.includes(w) || words.isTopicWord(w) || words.isStopword(w));
  return ok ? text[0]!.toUpperCase() + text.slice(1) : null;
}
