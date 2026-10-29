import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { isStory, nameFor, POST } from "../api/_share.js";
import { SHADEVS_STORY } from "../scripts/shadevs-story.ts";
import { toLink } from "../src/story/link.js";

const code = (x: unknown) => `v2.${deflateRawSync(JSON.stringify(x)).toString("base64url")}`;

test("a story's short name comes from the story, so the same story gets the same link", () => {
  const story = code(toLink(SHADEVS_STORY));
  assert.ok(isStory(story));
  assert.match(nameFor(story), /^[0-9A-Za-z]{10}$/);
  assert.equal(nameFor(story), nameFor(story));
  assert.notEqual(nameFor(story), nameFor(code(toLink({ ...SHADEVS_STORY, prompts: 1 }))));
});

test("only a story the player can play is saved", async () => {
  const story = code(toLink(SHADEVS_STORY));
  for (const junk of ["", "v2.", "hello", `v1.${story.slice(3)}`, code(["not", "a", "story"]), code({ prompts: 1 }), `${story}${"A".repeat(8_000)}`, "v2.%%%"]) {
    assert.equal(isStory(junk), false, junk.slice(0, 20));
  }
  // Turned away before anything is stored.
  const res = await POST(new Request("https://example.com/api/share", { method: "POST", body: "v2.nope" }));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
