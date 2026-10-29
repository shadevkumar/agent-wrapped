import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { SHADEVS_STORY } from "../scripts/shadevs-story.ts";
import { fromLink, toLink } from "../src/story/link.js";
import type { StoryData } from "../src/story.ts";

// Everything a link carries: the story without the two fields the player never reads.
function carried(s: StoryData) {
  const { id: _id, ...personality } = s.personality;
  return { ...s, personality, letter: { text: s.letter.text } };
}

const chapters = [{ from: "2026-01", to: "2026-03", name: "Scanner app" }];

test("a story comes out of its link exactly as it went in", () => {
  // A story from the CLI has every field; Shadev's was made before Cursor was read.
  const full = { ...SHADEVS_STORY, agents: { ...SHADEVS_STORY.agents!, cursor: 0 } };
  for (const story of [full, { ...full, chapters, talk: { ...full.talk!, nickname: null } }]) {
    // Through JSON, as the link does: a field the link lacks must not come back.
    assert.deepEqual(fromLink(JSON.parse(JSON.stringify(toLink(story)))), carried(story));
  }
});

test("a link made before a field existed still reads, without that field", () => {
  const values = toLink(SHADEVS_STORY);
  // `crashouts` is the newest field.
  const older = fromLink(values.slice(0, -1));
  assert.equal(older.crashouts, undefined);
  assert.equal(older.period, SHADEVS_STORY.period);
});

test("the link is a third shorter than one with the field names in it", () => {
  const size = (x: unknown) => deflateRawSync(JSON.stringify(x)).toString("base64url").length;
  assert.ok(size(toLink(SHADEVS_STORY)) < size(SHADEVS_STORY) * 0.75);
});
