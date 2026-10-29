import { existsSync, readFileSync } from "node:fs";

// Words and typos. Also the privacy gate: `safeQuote` decides which of the
// person's own words may appear on a card.

const SYSTEM_DICTIONARY = "/usr/share/dict/words";

// Everyday words the system dictionary (Webster's, 1934) doesn't know.
const MODERN = new Set(
  (
    "okay ok hey yeah yep nope bro dude lol lmao pls plz thx btw gonna wanna gotta kinda " +
    "email emails app apps api apis ui ux pr prs repo repos bug bugs code coding fix fixes " +
    "online offline login logout signup website web dev devs frontend backend deploy deployed " +
    "prod staging commit commits merge merged push pushed test tests tested lint debug debugging " +
    "dashboard dashboards workflow workflows feature features screenshot screenshots tab tabs " +
    "chat chats chatbot bot bots ai llm prompt prompts token tokens model models agent agents " +
    "data database json url urls link links laptop smartphone video videos " +
    "async await sync config configs env auth oauth cli npm yaml regex cron webhook webhooks " +
    "param params args arg enum const func init pre repo localhost wifi admin"
  ).split(" "),
);

// Words too plain to make a catchphrase on their own.
const STOPWORDS = new Set(
  "a an the to of in on at for and or is are was be it this that i you we me my your with as do so if".split(" "),
);

export class Words {
  private dict: Set<string>;
  private people: Set<string>;
  private blocked: Set<string>;

  // `names` are private names (folders, repos, orgs) that never appear in a
  // quote. A name is always blocked; its parts ("acme" in "acme-portal") are
  // blocked unless they are everyday words ("the" in "bridge-the-gap").
  // `people` are words the dictionary also lists as a name ("Mary", "Jack").
  constructor(names: Iterable<string>, dict?: Set<string>, people?: Set<string>) {
    this.dict = dict ?? loadDictionary(SYSTEM_DICTIONARY);
    this.people = people ?? (dict ? new Set() : loadNames(SYSTEM_DICTIONARY));
    this.blocked = new Set();
    for (const name of names) {
      const lower = name.toLowerCase();
      this.blocked.add(lower);
      for (const part of lower.split(/[-_.]/)) {
        if (part.length >= 3 && part !== lower && !this.isKnown(part)) this.blocked.add(part);
      }
    }
  }

  isBlocked(word: string): boolean {
    return this.blocked.has(word);
  }

  // A real everyday word, including plain inflections the dictionary lacks.
  isKnown(word: string): boolean {
    if (this.dict.has(word) || MODERN.has(word)) return true;
    for (const base of baseForms(word)) {
      if (this.dict.has(base) || MODERN.has(base)) return true;
    }
    return false;
  }

  // A quote is safe when every word is a known word or a known typo of one,
  // and none is a private name. Anything else (names, jargon, ids) drops the quote.
  safeQuote(text: string, typos: Map<string, string>): string | null {
    const words = tokenize(text);
    if (words.length === 0 || words.length > 12) return null;
    for (const w of words) {
      if (this.isBlocked(w)) return null;
      const canonical = typos.get(w);
      if (canonical && !this.isBlocked(canonical)) continue;
      if (!this.isKnown(w)) return null;
    }
    return words.join(" ");
  }

  isStopword(word: string): boolean {
    return STOPWORDS.has(word);
  }

  // A word safe to name a theme of the year with: an everyday word that is no
  // private name and could not be a person's name either. Stricter than a
  // quote, since it says what someone worked on; it may drop a word like "jack".
  isTopicWord(word: string): boolean {
    if (!this.isKnown(word) || this.isBlocked(word) || this.people.has(word)) return false;
    return !baseForms(word).some((base) => this.people.has(base));
  }
}

export function loadDictionary(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  const words = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    // Capitalized entries are names, so they are left out.
    if (line && line === line.toLowerCase()) words.add(line);
  }
  return words;
}

// The dictionary's capitalized entries (names of people and places), lowercased.
export function loadNames(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  const names = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line && line !== line.toLowerCase()) names.add(line.toLowerCase());
  }
  return names;
}

// Lowercase words, after removing code, links, paths and addresses.
export function tokenize(text: string): string[] {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, " ")
    .replace(/\b(?:https?|ftp|file|plugin):\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ")
    .replace(/(?:~|\.{1,2})?\/[\w./-]+/g, " ")
    .replace(/\b[\w-]+\.(?:ts|tsx|js|py|md|json|html|css|sql|yml|yaml|toml|sh|txt)\b/gi, " ")
    .toLowerCase();
  return plain.match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
}

function baseForms(w: string): string[] {
  const out: string[] = [];
  const strip = (suffix: string) => (w.endsWith(suffix) && w.length > suffix.length + 2 ? w.slice(0, -suffix.length) : null);
  for (const s of ["s", "es", "ed", "d", "ing", "ly", "er", "ers"]) {
    const b = strip(s);
    if (!b) continue;
    out.push(b, b + "e");
    // stopped -> stop, running -> run
    if (b.length > 2 && b.at(-1) === b.at(-2)) out.push(b.slice(0, -1));
  }
  const ies = strip("ies");
  if (ies) out.push(ies + "y");
  const ied = strip("ied");
  if (ied) out.push(ied + "y");
  return out;
}

// --- Typos -----------------------------------------------------------------

export interface TypoFamily {
  word: string;
  spellings: { spelling: string; count: number }[];
  total: number;
}

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const KEY_POS = new Map<string, [number, number]>();
ROWS.forEach((row, r) => [...row].forEach((ch, c) => KEY_POS.set(ch, [r, c + r * 0.5])));

function adjacentKeys(a: string, b: string): boolean {
  const pa = KEY_POS.get(a);
  const pb = KEY_POS.get(b);
  if (!pa || !pb || a === b) return false;
  return Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1;
}

export type Slip =
  | { kind: "neighbour"; meant: string; hit: string }
  | { kind: "swap" }
  | { kind: "missed"; meant: string }
  | { kind: "extra"; hit: string };

// How `typed` is `intended` with one slip of the fingers: two letters
// swapped, a neighbouring key hit instead, a letter missed, or a stray
// neighbouring/doubled key added. Other one-letter differences are usually
// different words ("code" / "codex"), so they return null.
export function fingerSlip(intended: string, typed: string): Slip | null {
  if (intended === typed) return null;
  const a = intended;
  const b = typed;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) {
      const meant = a[diff[0]!]!;
      const hit = b[diff[0]!]!;
      return a.length >= 4 && adjacentKeys(meant, hit) ? { kind: "neighbour", meant, hit } : null;
    }
    if (diff.length === 2) {
      const [i, j] = diff as [number, number];
      return j === i + 1 && a[i] === b[j] && a[j] === b[i] ? { kind: "swap" } : null;
    }
    return null;
  }
  if (a.length < 4) return null;
  if (b.length === a.length - 1) {
    for (let i = 0; i < a.length; i++) if (a.slice(0, i) + a.slice(i + 1) === b) return { kind: "missed", meant: a[i]! };
    return null;
  }
  if (b.length === a.length + 1) {
    for (let i = 0; i < b.length; i++) {
      if (b.slice(0, i) + b.slice(i + 1) !== a) continue;
      const hit = b[i]!;
      const left = b[i - 1];
      const right = b[i + 1];
      if (hit === left || hit === right) return { kind: "extra", hit };
      if ((left && adjacentKeys(hit, left)) || (right && adjacentKeys(hit, right))) return { kind: "extra", hit };
    }
  }
  return null;
}

export function isFingerSlip(intended: string, typed: string): boolean {
  return fingerSlip(intended, typed) !== null;
}

export interface KeySlips {
  // Neighbouring-key mistakes, most common first: meant "p", hit "o".
  neighbours: { meant: string; hit: string; count: number }[];
  swaps: number;
  missed: number;
  extra: number;
}

// Adds up every slip inside the typo families, weighted by how often each spelling was typed.
export function keySlips(families: TypoFamily[]): KeySlips {
  const pairs = new Map<string, number>();
  const out: KeySlips = { neighbours: [], swaps: 0, missed: 0, extra: 0 };
  for (const fam of families) {
    for (const { spelling, count } of fam.spellings) {
      const slip = fingerSlip(fam.word, spelling);
      if (!slip) continue;
      if (slip.kind === "neighbour") {
        const key = slip.meant + slip.hit;
        pairs.set(key, (pairs.get(key) ?? 0) + count);
      } else if (slip.kind === "swap") out.swaps += count;
      else if (slip.kind === "missed") out.missed += count;
      else out.extra += count;
    }
  }
  out.neighbours = [...pairs]
    .map(([k, count]) => ({ meant: k[0]!, hit: k[1]!, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);
  return out;
}

// Groups unknown spellings under the common word they were meant to be.
export function findTypos(
  counts: Map<string, number>,
  words: Words,
): { families: TypoFamily[]; canonical: Map<string, string> } {
  const common = [...counts.entries()]
    .filter(([w, n]) => n >= 5 && w.length >= 3 && words.isKnown(w) && !words.isBlocked(w))
    .sort((x, y) => y[1] - x[1]);
  const byFirst = new Map<string, [string, number][]>();
  for (const entry of common) {
    const list = byFirst.get(entry[0][0]!) ?? [];
    list.push(entry);
    byFirst.set(entry[0][0]!, list);
  }

  const canonical = new Map<string, string>();
  const families = new Map<string, TypoFamily>();
  for (const [typed, n] of counts) {
    if (typed.length < 3 || words.isKnown(typed) || words.isBlocked(typed)) continue;
    // Most frequent match wins; a "typo" as common as the word is a word of its own.
    // The second letter's list catches swapped first letters ("hte").
    const candidates = [...(byFirst.get(typed[0]!) ?? []), ...(byFirst.get(typed[1]!) ?? [])].sort(
      (x, y) => y[1] - x[1],
    );
    const match = candidates.find(([w, wn]) => n * 3 <= wn && isFingerSlip(w, typed));
    if (!match) continue;
    canonical.set(typed, match[0]);
    const fam = families.get(match[0]) ?? { word: match[0], spellings: [], total: 0 };
    fam.spellings.push({ spelling: typed, count: n });
    fam.total += n;
    families.set(match[0], fam);
  }
  for (const fam of families.values()) fam.spellings.sort((x, y) => y.count - x.count);
  const ranked = [...families.values()].sort(
    (x, y) => y.spellings.length - x.spellings.length || y.total - x.total,
  );
  return { families: ranked, canonical };
}
