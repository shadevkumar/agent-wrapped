import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function tempHome(): string {
  return mkdtempSync(join(tmpdir(), "agent-wrapped-"));
}

export function writeJsonl(path: string, rows: (object | string)[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, rows.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n") + "\n");
}

export function writeFile(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// Only the columns the reader uses, matching Codex's real column names.
export function codexStateDb(path: string, threads: Record<string, unknown>[]) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`create table threads (id text primary key, rollout_path text, created_at integer, cwd text,
    tokens_used integer, model text, git_origin_url text, source text)`);
  const insert = db.prepare("insert into threads values (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const t of threads) {
    insert.run(
      t.id as string,
      (t.rollout_path as string) ?? "",
      (t.created_at as number) ?? 1_780_000_000,
      (t.cwd as string) ?? "",
      (t.tokens_used as number) ?? 0,
      (t.model as string) ?? "gpt-5.5",
      (t.git_origin_url as string) ?? null,
      (t.source as string) ?? "vscode",
    );
  }
  db.close();
}

export function codexHistoryDb(path: string, messages: { thread: string; at: number; text: string }[]) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`create table thread_items (thread_id text, turn_id text, item_id text, rollout_ordinal integer,
    created_at_ms integer, item_json text, item_type text);
    create table thread_turns (thread_id text, turn_id text, started_at integer, duration_ms integer);`);
  const insert = db.prepare("insert into thread_items values (?, 't', ?, ?, ?, ?, 'userMessage')");
  messages.forEach((m, i) => {
    insert.run(m.thread, `item${i}`, i, m.at, JSON.stringify({ type: "userMessage", content: [{ type: "text", text: m.text }] }));
  });
  db.close();
}
