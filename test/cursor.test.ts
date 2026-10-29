import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { harvestCursor, parsePrompt } from "../src/sources/cursor.ts";
import { tempHome, writeJsonl } from "./helpers.ts";

const said = (text: string) => ({ role: "user", message: { content: [{ type: "text", text }] } });
const line = (time: string, query: string) => `<timestamp>${time}</timestamp>\n<user_query>\n${query}\n</user_query>`;
const typed = (time: string, query: string) => said(line(time, query));
const tools = (...uses: [string, object][]) => ({
  role: "assistant",
  message: { content: [{ type: "text", text: "On it." }, ...uses.map(([name, input]) => ({ type: "tool_use", name, input }))] },
});

test("Cursor's time is read in the zone it was written in", () => {
  assert.equal(parsePrompt(line("Friday, Aug 7, 2026, 5:58 PM (UTC+5:30)", "fix it"))?.at.toISOString(), "2026-08-07T12:28:00.000Z");
  assert.equal(parsePrompt(line("Monday, Jan 5, 2026, 12:05 AM (UTC-8)", "hi"))?.at.toISOString(), "2026-01-05T08:05:00.000Z");
  assert.equal(parsePrompt(line("Monday, Jan 5, 2026, 12:30 PM (UTC+0)", "hi"))?.at.toISOString(), "2026-01-05T12:30:00.000Z");
});

test("only what the person typed counts, once, even when a chat is saved twice", () => {
  const home = tempHome();
  const chat = [
    said("<mcp_meta_tools>\nYou have access to MCP tools\n</mcp_meta_tools>"),
    typed("Friday, Aug 7, 2026, 5:58 PM (UTC+5:30)", "run the tests okay?"),
    tools(["Shell", { command: "cd backend && pytest -q" }], ["StrReplace", { path: "/Users/me/acme/app.py" }], ["Read", { path: "/x.ts" }]),
    // Cursor reports a finished task back with no time on it.
    said("<user_query>Briefly inform the user about the task result</user_query>"),
    typed("Friday, Aug 7, 2026, 6:10 PM (UTC+5:30)", "commit it"),
    tools(["Shell", { command: 'git commit -m "Fix"' }]),
    "{half a line",
  ];
  writeJsonl(join(home, ".cursor/projects/Users-me-acme/agent-transcripts/c1/c1.jsonl"), chat);
  writeJsonl(join(home, ".cursor/projects/empty-window/agent-transcripts/c1/c1.jsonl"), chat.slice(0, 3));

  const h = harvestCursor(home);
  assert.deepEqual(h.prompts.map((p) => p.text), ["run the tests okay?", "commit it"]);
  assert.deepEqual(h.actions.map((a) => [a.kind, a.ext ?? null, a.at.toISOString()]), [
    ["test", null, "2026-08-07T12:28:00.000Z"],
    ["edit", ".py", "2026-08-07T12:28:00.000Z"],
    ["commit", null, "2026-08-07T12:40:00.000Z"],
  ]);
  assert.ok(h.privateNames.has("users-me-acme"));
});

test("no Cursor folder is an empty harvest", () => {
  const h = harvestCursor(tempHome());
  assert.equal(h.prompts.length, 0);
  assert.equal(h.coverage[0]?.count, 0);
});
