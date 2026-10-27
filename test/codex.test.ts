import assert from "node:assert/strict";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { cleanCodexPrompt, harvestCodex } from "../src/sources/codex.ts";
import { codexHistoryDb, codexStateDb, tempHome, writeJsonl } from "./helpers.ts";

test("a thread is counted once: split from its session file, else its total", () => {
  const home = tempHome();
  const rollout = join(home, ".codex/sessions/2026/10/01/rollout-a.jsonl");
  const total = (input: number, cached: number, output: number) => ({
    type: "event_msg",
    payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } },
  });
  // Running totals: only the last one counts.
  writeJsonl(rollout, [total(100, 80, 5), total(1000, 900, 50)]);
  codexStateDb(join(home, ".codex/state_5.sqlite"), [
    { id: "a", rollout_path: rollout, tokens_used: 1050 },
    { id: "b", rollout_path: join(home, "gone.jsonl"), tokens_used: 777 },
  ]);

  const h = harvestCodex(home);
  assert.equal(h.usage.length, 1);
  assert.deepEqual(
    { input: h.usage[0]!.input, cacheRead: h.usage[0]!.cacheRead, output: h.usage[0]!.output },
    { input: 100, cacheRead: 900, output: 50 },
  );
  assert.deepEqual(h.totals.map((t) => t.tokens), [777]);
});

test("the newest numbered database is read", () => {
  const home = tempHome();
  codexStateDb(join(home, ".codex/state_4.sqlite"), [{ id: "old", tokens_used: 1 }]);
  codexStateDb(join(home, ".codex/state_5.sqlite"), [{ id: "new", tokens_used: 2 }]);
  assert.deepEqual(harvestCodex(home).totals.map((t) => t.tokens), [2]);
});

test("only what a person typed becomes a prompt", () => {
  const home = tempHome();
  codexStateDb(join(home, ".codex/state_5.sqlite"), [
    { id: "human", source: "vscode" },
    { id: "child", source: '{"subagent":{"thread_spawn":{"depth":1}}}' },
  ]);
  codexHistoryDb(join(home, ".codex/thread_history_1.sqlite"), [
    { thread: "human", at: 1_790_000_000_000, text: "# Context from my IDE setup:\n\n## Active file: a.ts\n\n## My request for Codex:\nfix the graoh" },
    { thread: "human", at: 1_790_000_001_000, text: '<skill source="ambient-suggestions">try this</skill>' },
    { thread: "child", at: 1_790_000_002_000, text: "explore the repo and report back" },
    { thread: "deleted-thread", at: 1_790_000_003_000, text: "okay next" },
  ]);
  assert.deepEqual(harvestCodex(home).prompts.map((p) => p.text), ["fix the graoh", "okay next"]);
});

test("cleaning a wrapped request", () => {
  assert.equal(cleanCodexPrompt("# Files mentioned by the user:\n\n## a.ts: /x/a.ts\n\n## My request:\nship it"), "ship it");
  assert.equal(cleanCodexPrompt("## My request: inline"), "inline");
  assert.equal(cleanCodexPrompt("# Response annotations:\n\nnothing typed"), null);
  assert.equal(cleanCodexPrompt("<environment_context>cwd</environment_context>\nnext"), "next");
});

test("a changed Codex schema is reported as missing, not a crash", () => {
  const home = tempHome();
  const db = new DatabaseSync(join(home, ".codex-tmp.sqlite"));
  db.close();
  codexStateDb(join(home, ".codex/state_9.sqlite"), []);
  const broken = new DatabaseSync(join(home, ".codex/thread_history_2.sqlite"));
  broken.exec("create table thread_items (thread_id text)");
  broken.close();

  const h = harvestCodex(home);
  const prompts = h.coverage.find((c) => c.source === "prompts");
  assert.equal(prompts?.count, 0);
});
