import assert from "node:assert/strict";
import { test } from "node:test";
import { parseNames, safeName } from "../src/chapters.ts";
import { computeWrapped } from "../src/moments.ts";
import { emptyHarvest } from "../src/types.ts";
import { Words } from "../src/words.ts";

const DICT = new Set(
  ("the a of and for app fix ok calls pharmacy scanner labels robot printer barcode hospital discharge nurses " +
    "schedules shifts rosters landscaping crews lawns audio voice speech coaching jack").split(" "),
);
const PEOPLE = new Set(["mary", "jack"]);

// Six months, each with its own subject, plus words every month uses.
function wrappedWith(subjects: string[][], privateNames: string[] = []) {
  const h = emptyHarvest();
  for (const n of privateNames) h.privateNames.add(n);
  subjects.forEach((words, m) => {
    for (let i = 0; i < 20; i++) {
      h.prompts.push({ agent: "codex", text: `fix the ${words.join(" ")} calls app ok`, at: new Date(Date.UTC(2026, m, 1 + i, 12)), session: `s${m}` });
    }
  });
  return computeWrapped(h, new Words(h.privateNames, DICT, PEOPLE));
}

test("chapters split the year evenly and keep each stretch's own words", () => {
  const w = wrappedWith([
    ["pharmacy", "scanner", "labels"], ["robot", "printer", "barcode"], ["hospital", "discharge", "nurses"],
    ["schedules", "shifts", "rosters"], ["landscaping", "crews", "lawns"], ["audio", "voice", "speech"],
  ]);
  // 120 prompts in five stretches of about 24: a month joins the one its middle falls in.
  assert.deepEqual(w.chapters.map((c) => [c.from, c.to]), [
    ["2026-01", "2026-01"], ["2026-02", "2026-02"], ["2026-03", "2026-04"], ["2026-05", "2026-05"], ["2026-06", "2026-06"],
  ]);
  assert.deepEqual(w.chapters[2]!.words.slice().sort(), ["discharge", "hospital", "nurses", "rosters", "schedules", "shifts"]);
  // A word every stretch uses says nothing about it.
  for (const c of w.chapters) assert.ok(!c.words.includes("calls"));
});

test("a chapter never shows a person's or a private name", () => {
  const w = wrappedWith(
    [["pharmacy", "scanner", "labels", "mary", "acmecorp"], ["robot", "printer", "barcode", "jack"], ["hospital", "discharge", "nurses"]],
    ["acmecorp"],
  );
  assert.equal(w.chapters.length, 3);
  const all = w.chapters.flatMap((c) => c.words);
  for (const name of ["mary", "jack", "acmecorp"]) assert.ok(!all.includes(name), `showed ${name}`);
});

test("a chapter name from Claude is used only when every word in it is safe", () => {
  const words = new Words(["acmecorp"], DICT, PEOPLE);
  assert.equal(safeName("a pharmacy scanner app.", ["pharmacy", "scanner"], words), "A pharmacy scanner app");
  assert.equal(safeName("Scanner for Acmecorp", ["scanner"], words), null); // a private name
  assert.equal(safeName("Jack's pharmacy app", ["pharmacy"], words), null); // could be a person
  assert.equal(safeName("Pharmacy", ["pharmacy"], words), null); // too short to say anything
  assert.equal(safeName("Pharmacy app v2", ["pharmacy"], words), null); // not plain words
  assert.equal(safeName("Pharmacy scanner labels for the hospital robot app", ["pharmacy"], words), null); // too long for a row
});

test("Claude's reply must be one name per chapter", () => {
  assert.deepEqual(parseNames('Here you go: ["A", "B"]', 2), ["A", "B"]);
  assert.equal(parseNames('["A"]', 2), null);
  assert.equal(parseNames("no list", 1), null);
  assert.equal(parseNames('["A", 2]', 2), null);
});
