import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { coverage, firstJsonLine, lastJsonLine, namesFromGitUrl, namesFromPath, toDate } from "../files.ts";
import { commandKinds, emptyHarvest, type Harvest } from "../types.ts";

// Codex keeps, in ~/.codex:
// - state_N.sqlite `threads`: one row per thread, with its token total
// - thread_history_N.sqlite: every message and turn, kept long term
// - sessions/**/rollout-*.jsonl: token splits, only for recent threads
// These are Codex's internal files, so a query that no longer fits the
// schema is recorded as missing coverage instead of stopping the run.
export function harvestCodex(home: string): Harvest {
  const root = join(home, ".codex");
  const h = emptyHarvest();
  const human = new Map<string, boolean>(); // thread id -> started by a person
  const forks = forkedThreads(root);

  const state = openLatest(root, "state");
  if (state) {
    try {
      const rows = state
        .prepare("select id, rollout_path, created_at, cwd, tokens_used, model, git_origin_url, source from threads")
        .all() as Record<string, any>[];
      const threadDates: Date[] = [];
      for (const t of rows) {
        human.set(t.id, !String(t.source ?? "").startsWith("{"));
        if (t.cwd) for (const n of namesFromPath(t.cwd)) h.privateNames.add(n);
        if (t.git_origin_url) for (const n of namesFromGitUrl(t.git_origin_url)) h.privateNames.add(n);
        const at = toDate(Number(t.created_at) * 1000);
        if (!at) continue;
        threadDates.push(at);
        const model = String(t.model || "unknown");
        const split = t.rollout_path && existsSync(t.rollout_path) ? rolloutUsage(t.rollout_path) : null;
        if (split) {
          h.usage.push({ agent: "codex", model, at, ...split });
        } else if (Number(t.tokens_used) > 0 && !forks.has(t.id)) {
          h.totals.push({ agent: "codex", model, at, tokens: Number(t.tokens_used) });
        }
      }
      h.coverage.push(coverage("codex", "threads", threadDates));
    } catch {
      h.coverage.push(coverage("codex", "threads", []));
    } finally {
      state.close();
    }
  }

  const history = openLatest(root, "thread_history");
  if (history) {
    try {
      const items = history
        .prepare("select thread_id, created_at_ms, item_json from thread_items where item_type = 'userMessage'")
        .all() as Record<string, any>[];
      for (const item of items) {
        if (human.get(item.thread_id) === false) continue; // written by a parent agent
        const at = toDate(Number(item.created_at_ms));
        const text = cleanCodexPrompt(messageText(item.item_json));
        if (at && text) h.prompts.push({ agent: "codex", text, at, session: item.thread_id });
      }
      h.coverage.push(coverage("codex", "prompts", h.prompts.map((p) => p.at)));
    } catch {
      h.coverage.push(coverage("codex", "prompts", []));
    }
    try {
      const turns = history
        .prepare("select started_at, duration_ms from thread_turns where duration_ms > 0")
        .all() as Record<string, any>[];
      for (const t of turns) {
        const at = toDate(Number(t.started_at) * 1000);
        if (at) h.turns.push({ agent: "codex", at, durationMs: Number(t.duration_ms) });
      }
    } catch {
      // Without turn timings the story skips agent hours; prompts still count.
    }
    try {
      for (const t of history.prepare("select started_at from thread_turns where status = 'interrupted'").all() as Record<string, any>[]) {
        const at = toDate(Number(t.started_at) * 1000);
        if (at) h.actions.push({ agent: "codex", at, kind: "stop" });
      }
    } catch {
      // Older histories don't record how a turn ended.
    }
    try {
      // Each item also holds the command's output or the file's diff, often
      // far larger than the rest, so only its start is read: the command or
      // the first file path is near the top.
      const items = history
        .prepare(`select item_type, created_at_ms, substr(item_json, 1, 1200) as head from thread_items
          where item_type in ('commandExecution', 'fileChange')`)
        .all() as Record<string, any>[];
      for (const item of items) {
        const at = toDate(Number(item.created_at_ms));
        if (!at) continue;
        if (item.item_type === "fileChange") {
          const path = firstString(item.head, "path");
          if (path) h.actions.push({ agent: "codex", at, kind: "edit", ext: extname(path).toLowerCase() });
        } else {
          for (const kind of commandKinds(firstString(item.head, "command") ?? "")) h.actions.push({ agent: "codex", at, kind });
        }
      }
    } catch {
      // Without these the story skips what the agents did; the rest still works.
    } finally {
      history.close();
    }
  }
  return h;
}

// The first "key":"value" string in a piece of JSON that may be cut off.
function firstString(json: string, key: string): string | null {
  const m = json.match(new RegExp(`"${key}":("(?:[^"\\\\]|\\\\.)*")`));
  if (!m) return null;
  try {
    return JSON.parse(m[1]!);
  } catch {
    return null;
  }
}

// The Codex app wraps a typed request with IDE context and tagged blocks.
// Returns only what the person typed, or null for text Codex wrote itself.
export function cleanCodexPrompt(raw: string): string | null {
  if (raw.includes('source="ambient-')) return null;
  const markers = [...raw.matchAll(/^## My request(?: for Codex)?:[ \t]*/gm)];
  const last = markers.at(-1);
  if (!last && raw.trimStart().startsWith("# ")) return null;
  const typed = last ? raw.slice(last.index + last[0].length) : raw;
  const text = typed.replace(/<([A-Za-z_][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g, "").trim();
  return text || null;
}

function messageText(json: string): string {
  try {
    const content = JSON.parse(json)?.content;
    if (!Array.isArray(content)) return "";
    return content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("\n");
  } catch {
    return "";
  }
}

// A forked or resumed thread's running total starts from the total of the
// thread it came from, which is already counted there. Its own tokens are
// its final total less what it started with, before its first turn.
function rolloutUsage(path: string) {
  const isCount = (r: Record<string, any>) => r.type === "event_msg" && r.payload?.type === "token_count" && !!r.payload.info?.total_token_usage;
  const last = lastJsonLine(path, '"token_count"', isCount)?.payload.info;
  if (!last) return null;
  const first = firstJsonLine(path, '"token_count"', isCount)?.payload.info;
  // `input_tokens` includes cached tokens.
  const own = (key: string) =>
    (last.total_token_usage[key] ?? 0) - (first.total_token_usage[key] ?? 0) + (first.last_token_usage?.[key] ?? first.total_token_usage[key] ?? 0);
  const cached = own("cached_input_tokens");
  return {
    input: own("input_tokens") - cached,
    cacheRead: cached,
    cacheWrite: own("cache_write_input_tokens"),
    cacheWrite1h: 0,
    output: own("output_tokens"),
  };
}

// Threads forked from another, whose log starts with the other thread's
// history (their first item sits far into it). Their totals include the
// other thread's tokens, with no way left to tell how many, so a thread
// known only by its total is left unpriced: the cost stays a floor.
const FORKED_AFTER_ORDINAL = 100;
function forkedThreads(root: string): Set<string> {
  const history = openLatest(root, "thread_history");
  if (!history) return new Set();
  try {
    const rows = history
      .prepare("select thread_id from thread_items group by thread_id having min(rollout_ordinal) > ?")
      .all(FORKED_AFTER_ORDINAL) as Record<string, any>[];
    return new Set(rows.map((r) => String(r.thread_id)));
  } catch {
    return new Set();
  } finally {
    history.close();
  }
}

// Codex numbers its database files (state_5.sqlite); open the newest, read-only.
function openLatest(root: string, prefix: string): DatabaseSync | null {
  if (!existsSync(root)) return null;
  const pattern = new RegExp(`^${prefix}_(\\d+)\\.sqlite$`);
  const newest = readdirSync(root)
    .map((f) => ({ f, n: Number(f.match(pattern)?.[1] ?? -1) }))
    .filter((x) => x.n >= 0)
    .sort((a, b) => b.n - a.n)[0];
  if (!newest) return null;
  try {
    return new DatabaseSync(join(root, newest.f), { readOnly: true });
  } catch {
    return null;
  }
}
