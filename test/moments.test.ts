import assert from "node:assert/strict";
import { test } from "node:test";
import { computeWrapped, doubleSends, longestStreak } from "../src/moments.ts";
import { emptyHarvest, type Prompt } from "../src/types.ts";
import { Words } from "../src/words.ts";

const T0 = Date.parse("2026-10-01T09:00:00Z");
const p = (text: string, ms: number, session = "s1"): Prompt => ({ agent: "codex", text, at: new Date(T0 + ms), session });

test("a streak breaks on a missed day and counts a single day", () => {
  assert.deepEqual(longestStreak(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-03"]), {
    days: 3,
    from: "2026-01-30",
    to: "2026-02-01",
  });
  assert.deepEqual(longestStreak(["2026-05-05"]), { days: 1, from: "2026-05-05", to: "2026-05-05" });
  assert.equal(longestStreak([]), null);
});

test("a double send is a repeat 1 second to 2 minutes later in the same session", () => {
  assert.equal(doubleSends([p("next", 0), p("next", 999)]), 0); // the logs writing it twice
  assert.equal(doubleSends([p("next", 0), p("next", 1_000)]), 1);
  assert.equal(doubleSends([p("next", 0), p("next", 120_000)]), 1);
  assert.equal(doubleSends([p("next", 0), p("next", 120_001)]), 0);
  assert.equal(doubleSends([p("next", 0, "a"), p("next", 5_000, "b")]), 0);
});

test("pasted text isn't a catchphrase, typed habits are", () => {
  const dict = new Set(
    "please review the pull request against main and fix every conflict you find make sure nothing breaks ok".split(" "),
  );
  const h = emptyHarvest();
  const template = "please review the pull request against main and fix every conflict you find";
  for (let i = 0; i < 4; i++) {
    h.prompts.push(p(template, i * 60_000, `paste${i}`));
    h.prompts.push(p("make sure nothing breaks", i * 60_000 + 1, `typed${i}`));
  }
  const w = computeWrapped(h, new Words([], dict));
  const phrases = w.voice.catchphrases.map((c) => c.text);
  assert.ok(phrases.includes("make sure nothing breaks"));
  assert.ok(!phrases.some((t) => t.includes("conflict") || t.includes("review")));
  assert.equal(w.voice.pastedShare, 0.5);
});

test("an empty harvest still produces a story shape", () => {
  const w = computeWrapped(emptyHarvest(), new Words([], new Set()));
  assert.equal(w.totals.prompts, 0);
  assert.equal(w.rhythm.longestStreak, null);
  assert.equal(w.voice.medianWords, 0);
});
