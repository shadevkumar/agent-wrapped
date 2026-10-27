import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { lastJsonLine } from "../src/files.ts";
import { tempHome } from "./helpers.ts";

const isTotal = (r: Record<string, any>) => r.kind === "total";

test("the last matching line is found across 1 MB chunks, intact", () => {
  const path = join(tempHome(), "big.jsonl");
  const filler = JSON.stringify({ kind: "noise", text: "é😀".repeat(5000) }); // multi-byte text near every edge
  const lines: string[] = [];
  for (let i = 0; i < 120; i++) lines.push(i === 40 ? JSON.stringify({ kind: "total", n: 7, note: "größe 😀" }) : filler);
  writeFileSync(path, lines.join("\n") + "\n");

  const row = lastJsonLine(path, '"total"', isTotal);
  assert.deepEqual(row, { kind: "total", n: 7, note: "größe 😀" });
});

test("the newest total wins, a half-written last line is ignored, and no match is null", () => {
  const path = join(tempHome(), "log.jsonl");
  writeFileSync(path, ['{"kind":"total","n":1}', '{"kind":"total","n":2}', '{"kind":"total","n":'].join("\n"));
  assert.equal(lastJsonLine(path, '"total"', isTotal)?.n, 2);
  assert.equal(lastJsonLine(path, '"nothing"', isTotal), null);
  assert.equal(lastJsonLine(join(tempHome(), "missing.jsonl"), '"total"', isTotal), null);
});
