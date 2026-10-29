import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { harvestClaude } from "../src/sources/claude.ts";
import { tempHome, writeFile, writeJsonl } from "./helpers.ts";

function reply(id: string, requestId: string, timestamp: string, usage: object, model = "claude-opus-5-5") {
  return { type: "assistant", requestId, timestamp, message: { id, model, usage } };
}

test("a reply split across several lines is counted once, with its final usage", () => {
  const home = tempHome();
  const usage = (output: number) => ({ input_tokens: 10, cache_read_input_tokens: 100, output_tokens: output });
  writeJsonl(join(home, ".claude/projects/-Users-me-app/s1.jsonl"), [
    reply("msg_1", "req_1", "2026-10-20T10:00:00Z", usage(5)),
    reply("msg_1", "req_1", "2026-10-20T10:00:01Z", usage(40)),
    reply("msg_1", "req_1", "2026-10-20T10:00:02Z", usage(40)),
    reply("msg_2", "req_2", "2026-10-20T10:01:00Z", usage(7)),
  ]);
  // A resumed session copies the same reply into a second file.
  writeJsonl(join(home, ".claude/projects/-Users-me-app/s2.jsonl"), [
    reply("msg_1", "req_1", "2026-10-20T10:00:02Z", usage(40)),
  ]);

  const h = harvestClaude(home);
  assert.equal(h.usage.length, 2);
  assert.deepEqual(h.usage.map((u) => u.output).sort((a, b) => a - b), [7, 40]);
});

test("replies already inside the older totals are not counted again", () => {
  const home = tempHome();
  writeFile(
    join(home, ".claude/stats-cache.json"),
    JSON.stringify({
      lastComputedDate: "2026-02-20",
      dailyActivity: [{ date: "2026-02-19" }, { date: "2026-02-20" }],
      modelUsage: {
        "claude-opus-4-5-20251101": { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4 },
      },
    }),
  );
  writeJsonl(join(home, ".claude/projects/p/s.jsonl"), [
    reply("old", "r1", "2026-02-20T12:00:00Z", { input_tokens: 999, output_tokens: 999 }),
    reply("new", "r2", "2026-02-21T12:00:00Z", { input_tokens: 5, output_tokens: 6 }),
  ]);

  const h = harvestClaude(home);
  const byModel = Object.fromEntries(h.usage.map((u) => [u.model, u]));
  assert.equal(h.usage.length, 2);
  assert.equal(byModel["claude-opus-4-5-20251101"]?.cacheWrite, 4);
  assert.equal(byModel["claude-opus-5-5"]?.input, 5);
});

test("1-hour cache writes are kept apart from 5-minute ones", () => {
  const home = tempHome();
  writeJsonl(join(home, ".claude/projects/p/s.jsonl"), [
    reply("m", "r", "2026-10-20T10:00:00Z", {
      cache_creation_input_tokens: 1000,
      cache_creation: { ephemeral_5m_input_tokens: 300, ephemeral_1h_input_tokens: 700 },
    }),
  ]);
  const [u] = harvestClaude(home).usage;
  assert.equal(u?.cacheWrite, 300);
  assert.equal(u?.cacheWrite1h, 700);
});

test("prompt history keeps typed words and drops commands, pastes and broken lines", () => {
  const home = tempHome();
  writeJsonl(join(home, ".claude/history.jsonl"), [
    { display: "fix the graph [Pasted text #1 +20 lines]", timestamp: 1_790_000_000_000, project: "/Users/me/acme-portal", sessionId: "s" },
    { display: "/clear", timestamp: 1_790_000_001_000, project: "/Users/me/acme-portal", sessionId: "s" },
    { display: "!ls", timestamp: 1_790_000_002_000, sessionId: "s" },
    { display: "[Image #1]", timestamp: 1_790_000_003_000, sessionId: "s" },
    '{"display": "half a line',
  ]);
  const h = harvestClaude(home);
  assert.deepEqual(h.prompts.map((p) => p.text), ["fix the graph"]);
  assert.ok(h.privateNames.has("acme-portal"));
  assert.ok(h.privateNames.has("acmeportal"));
});

test("tests, commits, edits and stops are counted once each, as kinds only", () => {
  const home = tempHome();
  writeFile(join(home, ".claude/stats-cache.json"), JSON.stringify({ lastComputedDate: "2026-10-25", modelUsage: {} }));
  const tool = (id: string, name: string, input: object) => ({ type: "tool_use", id, name, input });
  const turn = {
    type: "assistant", timestamp: "2026-10-20T10:00:00Z",
    message: { id: "m1", content: [
      { type: "text", text: "Running them now." },
      tool("t1", "Bash", { command: "cd app && npm test -- --watch=false" }),
      tool("t2", "Bash", { command: "git add -A && git commit -m 'ship /Users/me/acmecorp'" }),
      tool("t3", "Bash", { command: "ls -la" }),
      tool("t4", "Edit", { file_path: "/Users/me/acmecorp/billing.PY", old_string: "a", new_string: "b" }),
      tool("t5", "Read", { file_path: "/Users/me/acmecorp/notes.md" }),
    ] },
  };
  const stop = { type: "user", uuid: "u1", timestamp: "2026-10-20T10:02:00Z", message: { role: "user", content: [{ type: "text", text: "[Request interrupted by user]" }] } };
  writeJsonl(join(home, ".claude/projects/p/s1.jsonl"), [turn, stop]);
  // A resumed session copies the same turn and stop.
  writeJsonl(join(home, ".claude/projects/p/s2.jsonl"), [turn, stop]);

  const h = harvestClaude(home);
  assert.deepEqual(h.actions.map((a) => [a.kind, a.ext ?? null]).sort(), [["commit", null], ["edit", ".py"], ["stop", null], ["test", null]]);
  assert.ok(!JSON.stringify(h.actions).includes("acmecorp"));
});

test("no Claude folder gives an empty harvest", () => {
  const h = harvestClaude(tempHome());
  assert.equal(h.prompts.length, 0);
  assert.equal(h.usage.length, 0);
});
