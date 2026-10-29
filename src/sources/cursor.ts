import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { coverage, readJsonl, toDate } from "../files.ts";
import { commandKinds, emptyHarvest, type Harvest } from "../types.ts";

// Cursor's agent keeps one transcript per chat in
// ~/.cursor/projects/<folder>/agent-transcripts/<chat>/<chat>.jsonl. A line is
// a user or assistant message; only the person's lines carry a time, written
// into the text as <timestamp>, with what they typed in <user_query>. Lines
// without both are instructions Cursor added itself. The same chat can be
// saved under two folders, so each prompt and action counts once.
export function harvestCursor(home: string): Harvest {
  const root = join(home, ".cursor", "projects");
  const h = emptyHarvest();
  const seen = new Set<string>();
  for (const folder of list(root)) {
    // The folder is the project path with dashes ("Users-me-acme-portal").
    h.privateNames.add(folder.toLowerCase());
    for (const chat of list(join(root, folder, "agent-transcripts"))) {
      let at: Date | null = null; // the person's latest prompt, the time of what follows
      let step = 0;
      for (const row of readJsonl(join(root, folder, "agent-transcripts", chat, `${chat}.jsonl`))) {
        const content = Array.isArray(row.message?.content) ? row.message.content : [];
        if (row.role === "user") {
          const prompt = parsePrompt(content.map((b: any) => b?.text ?? "").join(""));
          if (!prompt) continue;
          at = prompt.at;
          step = 0;
          const id = `${chat}|${at.getTime()}|${prompt.text}`;
          if (seen.has(id)) continue;
          seen.add(id);
          h.prompts.push({ agent: "cursor", text: prompt.text, at, session: chat });
          continue;
        }
        if (row.role !== "assistant" || !at) continue;
        for (const b of content) {
          if (b?.type !== "tool_use") continue;
          const id = `${chat}|${at.getTime()}|${step++}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const path = b.input?.path;
          if (EDIT_TOOLS.has(b.name) && typeof path === "string") h.actions.push({ agent: "cursor", at, kind: "edit", ext: extname(path).toLowerCase() });
          if (b.name === "Shell") for (const kind of commandKinds(String(b.input?.command ?? ""))) h.actions.push({ agent: "cursor", at, kind });
        }
      }
    }
  }
  h.coverage.push(coverage("cursor", "prompts", h.prompts.map((p) => p.at)));
  return h;
}

const EDIT_TOOLS = new Set(["StrReplace", "Write", "EditNotebook"]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "<timestamp>Friday, Aug 7, 2026, 5:58 PM (UTC+5:30)</timestamp>
// <user_query>fix it</user_query>" -> the time and "fix it".
export function parsePrompt(raw: string): { at: Date; text: string } | null {
  const time = raw.match(/<timestamp>[^<]*?(\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([AP]M) \(UTC([+-])(\d{1,2})(?::(\d{2}))?\)<\/timestamp>/);
  const query = raw.match(/<user_query>([\s\S]*?)<\/user_query>/);
  const month = MONTHS.indexOf(time?.[1] ?? "");
  const text = query?.[1]?.trim();
  if (!time || !text || month < 0) return null;
  const hour = (Number(time[4]) % 12) + (time[6] === "PM" ? 12 : 0);
  const offset = (time[7] === "-" ? -1 : 1) * (Number(time[8]) * 60 + Number(time[9] ?? 0));
  const at = toDate(Date.UTC(Number(time[3]), month, Number(time[2]), hour, Number(time[5])) - offset * 60_000);
  return at ? { at, text } : null;
}

function list(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name);
  } catch {
    return [];
  }
}
