import assert from "node:assert/strict";
import { test } from "node:test";
import { findTypos, isFingerSlip, tokenize, Words } from "../src/words.ts";

const dict = new Set(["graph", "the", "everything", "continue", "check", "code", "form", "from", "break", "change", "next"]);

test("finger slips are typos; other one-letter changes are not", () => {
  for (const [intended, typed] of [
    ["graph", "graoh"], // neighbouring key
    ["the", "teh"], // swapped letters
    ["everything", "evrything"], // missed letter
    ["continue", "contineu"], // swapped at the end
    ["check", "chcek"],
    ["next", "nextt"], // doubled key
  ] as const) {
    assert.ok(isFingerSlip(intended, typed), `${typed} should be a slip of ${intended}`);
  }
  assert.equal(isFingerSlip("code", "codex"), false); // x is nowhere near e
  assert.equal(isFingerSlip("graph", "grapl"), false); // l is far from h
  assert.equal(isFingerSlip("the", "thy"), false); // too short for a substitution
});

test("typo families skip real words, private names and spellings as common as the word", () => {
  const words = new Words(["grapho"], dict);
  const counts = new Map([
    ["graph", 30],
    ["graoh", 6],
    ["grapho", 2], // a private name, never a typo
    ["form", 1], // a real word, though one swap from "from"
    ["from", 40],
    ["code", 20],
    ["codez", 20], // as common as the word: a word of its own
  ]);
  const { families, canonical } = findTypos(counts, words);
  assert.deepEqual(families.map((f) => [f.word, f.spellings.map((s) => s.spelling)]), [["graph", ["graoh"]]]);
  assert.equal(canonical.get("form"), undefined);
});

test("a folder name is blocked, and so are its parts unless they are everyday words", () => {
  const words = new Words(["bridge-the-gap", "acme-portal", "next"], new Set([...dict, "bridge", "gap", "portal"]));
  assert.ok(words.isBlocked("bridge-the-gap"));
  assert.ok(words.isBlocked("acme"));
  assert.ok(words.isBlocked("next")); // a whole folder name, even though it's a word
  assert.equal(words.isBlocked("the"), false);
  assert.equal(words.isBlocked("portal"), false);
});

test("plain inflections count as known words", () => {
  const words = new Words([], dict);
  for (const w of ["breaks", "changes", "changed", "checking", "deployed", "emails"]) {
    assert.ok(words.isKnown(w), w);
  }
  assert.equal(words.isKnown("zentrix"), false);
});

test("tokenize drops code, links, paths and addresses", () => {
  assert.deepEqual(
    tokenize("fix `const x` see [docs](https://x.io) at ~/work/app/main.ts or me@acme.io and https://acme.io/a ok"),
    ["fix", "see", "at", "or", "and", "ok"],
  );
});
