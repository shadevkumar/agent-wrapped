import { closeSync, existsSync, fstatSync, openSync, readdirSync, readFileSync, readSync } from "node:fs";
import { basename, join } from "node:path";
import type { Coverage, Agent } from "./types.ts";

// Parse a JSONL file, skipping malformed lines. A missing file is empty.
// `keep` skips decoding lines that can't matter, which is most of a big log.
export function readJsonl(path: string, keep?: (line: string) => boolean): Record<string, any>[] {
  if (!existsSync(path)) return [];
  const rows: Record<string, any>[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim() || (keep && !keep(line))) continue;
    try {
      const row = JSON.parse(line);
      if (row && typeof row === "object") rows.push(row);
    } catch {
      // A half-written last line is normal while an agent is running.
    }
  }
  return rows;
}

// The last line containing `needle` that parses and passes `accept`, read
// backwards from the end of the file, so a 300 MB log costs one small read.
export function lastJsonLine(
  path: string,
  needle: string,
  accept: (row: Record<string, any>) => boolean,
): Record<string, any> | null {
  if (!existsSync(path)) return null;
  const fd = openSync(path, "r");
  try {
    const chunk = 1 << 20;
    let end = fstatSync(fd).size;
    let tail = Buffer.alloc(0);
    while (end > 0) {
      const start = Math.max(0, end - chunk);
      const buf = Buffer.alloc(end - start);
      readSync(fd, buf, 0, buf.length, start);
      tail = Buffer.concat([buf, tail]);
      end = start;
      // Until the start of the file, the first line may be cut in half. Split
      // on bytes, so a character cut at the chunk edge is never decoded.
      const firstBreak = end > 0 ? tail.indexOf(0x0a) : -1;
      const lines = tail.subarray(firstBreak + 1).toString("utf8").split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i]!.includes(needle)) continue;
        try {
          const row = JSON.parse(lines[i]!);
          if (row && accept(row)) return row;
        } catch {
          // A half-written last line while the agent runs.
        }
      }
      tail = firstBreak >= 0 ? tail.subarray(0, firstBreak) : Buffer.alloc(0);
    }
    return null;
  } finally {
    closeSync(fd);
  }
}

// The first line containing `needle` that parses and passes `accept`, read
// from the start a chunk at a time.
export function firstJsonLine(
  path: string,
  needle: string,
  accept: (row: Record<string, any>) => boolean,
): Record<string, any> | null {
  if (!existsSync(path)) return null;
  const fd = openSync(path, "r");
  try {
    const chunk = 1 << 20;
    const size = fstatSync(fd).size;
    let rest = Buffer.alloc(0);
    for (let at = 0; at < size; at += chunk) {
      const buf = Buffer.alloc(Math.min(chunk, size - at));
      readSync(fd, buf, 0, buf.length, at);
      const data = Buffer.concat([rest, buf]);
      // A line cut at the chunk edge waits for the next read. Split on bytes,
      // so a character cut in half is never decoded.
      const end = at + buf.length >= size ? data.length : data.lastIndexOf(0x0a) + 1;
      for (const line of data.subarray(0, end).toString("utf8").split("\n")) {
        if (!line.includes(needle)) continue;
        try {
          const row = JSON.parse(line);
          if (row && accept(row)) return row;
        } catch {
          // A malformed line; keep looking.
        }
      }
      rest = data.subarray(end);
    }
    return null;
  } finally {
    closeSync(fd);
  }
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
