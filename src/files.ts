import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Coverage, Agent } from "./types.ts";

// Parse a JSONL file, skipping malformed lines. A missing file is empty.
export function readJsonl(path: string): Record<string, any>[] {
  if (!existsSync(path)) return [];
  const rows: Record<string, any>[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row === "object") rows.push(row);
    } catch {
      // A half-written last line is normal while an agent is running.
    }
  }
  return rows;
}

export function readJson(path: string): Record<string, any> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => join(dir, f));
}

export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function coverage(agent: Agent, source: string, dates: Date[]): Coverage {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const d of dates) {
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
  }
  return { agent, source, count: dates.length, from, to };
}

// Names worth keeping out of quotes: the folder name, written as one word
// too. `Words` also blocks its dash-separated parts that aren't real words.
export function namesFromPath(path: string): string[] {
  const base = basename(path.replace(/\/+$/, "")).toLowerCase();
  if (!base) return [];
  return [base, base.replace(/[-_.]/g, "")];
}

export function namesFromGitUrl(url: string): string[] {
  const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  return m ? [...namesFromPath(m[1]!), ...namesFromPath(m[2]!)] : [];
}

export function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
