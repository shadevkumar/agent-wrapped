import { join } from "node:path";
import { coverage, findFiles, localDay, namesFromPath, readJson, readJsonl, toDate } from "../files.ts";
import { emptyHarvest, type Harvest, type Usage } from "../types.ts";

// Claude Code keeps three things in ~/.claude:
// - history.jsonl: every prompt typed, kept long term
// - stats-cache.json: older token totals per model, up to `lastComputedDate`
// - projects/**/*.jsonl: full transcripts, cleaned up after about 30 days
export function harvestClaude(home: string): Harvest {
  const root = join(home, ".claude");
  const h = emptyHarvest();

  for (const row of readJsonl(join(root, "history.jsonl"))) {
    if (typeof row.project === "string") addNames(h, namesFromPath(row.project));
    const at = toDate(row.timestamp);
    const text = cleanClaudePrompt(String(row.display ?? ""));
    if (!at || !text) continue;
    h.prompts.push({ agent: "claude", text, at, session: String(row.sessionId ?? "") });
  }
  h.coverage.push(coverage("claude", "prompts", h.prompts.map((p) => p.at)));

  // Transcript replies on or before this day are already inside the stats totals.
  const stats = readJson(join(root, "stats-cache.json"));
  const statsDay = typeof stats?.lastComputedDate === "string" ? (stats.lastComputedDate as string) : null;
  const statsAt = statsDay ? toDate(`${statsDay}T12:00:00`) : null;
  if (stats && statsAt) {
    for (const [model, u] of Object.entries<Record<string, unknown>>(stats.modelUsage ?? {})) {
      h.usage.push({
        agent: "claude",
        model,
        at: statsAt,
        input: num(u.inputTokens),
        cacheRead: num(u.cacheReadInputTokens),
        cacheWrite: num(u.cacheCreationInputTokens),
        cacheWrite1h: 0,
        output: num(u.outputTokens),
      });
    }
    const days = (stats.dailyActivity ?? []).map((d: any) => toDate(`${d?.date}T12:00:00`)).filter(Boolean);
    h.coverage.push(coverage("claude", "older token totals", days));
  }

  // Claude Code writes one line per content block, each repeating the reply's
  // usage, and copies history into resumed sessions. Count each reply once.
  const replies = new Map<string, Usage>();
  const turnIds = new Set<string>();
  // Only replies and turn timings matter here; tool output and attachments,
  // most of each file, are skipped without being decoded.
  const relevant = (line: string) => line.includes('"type":"assistant"') || line.includes('"turn_duration"');
  for (const file of findFiles(join(root, "projects"), ".jsonl")) {
    for (const row of readJsonl(file, relevant)) {
      if (typeof row.cwd === "string") addNames(h, namesFromPath(row.cwd));
      const at = toDate(row.timestamp);
      if (!at || (statsDay && localDay(at) <= statsDay)) continue;

      if (row.type === "system" && row.subtype === "turn_duration" && num(row.durationMs) > 0) {
        const id = String(row.uuid ?? `${row.sessionId}|${row.timestamp}`);
        if (!turnIds.has(id)) {
          turnIds.add(id);
          h.turns.push({ agent: "claude", at, durationMs: num(row.durationMs) });
        }
        continue;
      }

      const m = row.type === "assistant" ? row.message : null;
      if (!m?.usage || typeof m.model !== "string" || m.model === "<synthetic>") continue;
      const writes = num(m.usage.cache_creation_input_tokens);
      const writes1h = Math.min(writes, num(m.usage.cache_creation?.ephemeral_1h_input_tokens));
      const usage: Usage = {
        agent: "claude",
        model: m.model,
        at,
        input: num(m.usage.input_tokens),
        cacheRead: num(m.usage.cache_read_input_tokens),
        cacheWrite: writes - writes1h,
        cacheWrite1h: writes1h,
        output: num(m.usage.output_tokens),
      };
      const key = `${m.id ?? row.uuid}|${row.requestId ?? ""}`;
      const seen = replies.get(key);
      if (!seen || usage.output >= seen.output) replies.set(key, usage);
    }
  }
  h.usage.push(...replies.values());
  h.coverage.push(coverage("claude", "replies", [...replies.values()].map((u) => u.at)));
  return h;
}

// Drops slash and shell commands and paste placeholders; keeps what was typed.
export function cleanClaudePrompt(raw: string): string | null {
  const text = raw
    .replace(/\[(Pasted text|Image) #\d+[^\]]*\]/g, "")
    .trim();
  if (!text || text.startsWith("/") || text.startsWith("!")) return null;
  return text;
}

function addNames(h: Harvest, names: string[]) {
  for (const n of names) h.privateNames.add(n);
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
