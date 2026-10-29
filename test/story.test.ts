import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildHtml } from "../src/build.ts";
import { templateLetter, writeLetter } from "../src/letter.ts";
import { computeWrapped, type Wrapped } from "../src/moments.ts";
import { pickPersonality } from "../src/personality.ts";
import { pickCatchphrase, storyData } from "../src/story.ts";
import { emptyHarvest } from "../src/types.ts";
import { Words } from "../src/words.ts";

function wrappedWith(prompts: string[], hourUtc = 14): Wrapped {
  const h = emptyHarvest();
  prompts.forEach((text, i) =>
    h.prompts.push({ agent: "codex", text, at: new Date(Date.UTC(2026, 9, 1 + (i % 20), hourUtc, i % 60)), session: `s${i % 7}` }),
  );
  return computeWrapped(h, new Words([], new Set("ok next fix it make sure nothing breaks".split(" "))));
}

test("how you talk shows the nickname you use most, only once it's a habit", () => {
  const p = pickPersonality(wrappedWith([]));
  const letter = { text: "", by: "template" as const };
  const story = (prompts: string[]) => storyData(wrappedWith(prompts), p, letter);
  const shown = story([...Array(20).fill("ok dude next"), ...Array(5).fill("fix it bro"), "please fix it"]).talk;
  assert.deepEqual(shown?.nickname, { word: "dude", count: 20 });
  assert.equal(shown?.please, 1);
  assert.equal(story([...Array(19).fill("ok dude next"), "okay?"]).talk, null);
  assert.equal(story(Array(20).fill("next okay?")).talk?.checkIns, 20);
});

test("what the agents did starts at their first test, commit or edit, not at older stops", () => {
  const h = emptyHarvest();
  const at = (day: number) => new Date(Date.UTC(2026, 5, day, 12));
  h.actions.push({ agent: "codex", at: at(1), kind: "stop" });
  h.actions.push(...Array.from({ length: 8 }, (_, i) => ({ agent: "codex" as const, at: at(10 + i), kind: "test" as const })));
  h.actions.push({ agent: "claude", at: at(20), kind: "commit" }, { agent: "claude", at: at(21), kind: "edit", ext: ".tsx" });
  h.actions.push({ agent: "claude", at: at(22), kind: "edit", ext: ".md" });
  const w = computeWrapped(h, new Words([], new Set()));
  assert.equal(w.work.since, "2026-06-10");
  assert.deepEqual(w.work.languages, [{ name: "TypeScript", edits: 1 }]);
  const p = pickPersonality(w);
  // 9 tests and commits is not enough for a card; one more is.
  assert.equal(storyData(w, p, { text: "", by: "template" }).work, null);
  h.actions.push({ agent: "codex", at: at(25), kind: "commit" });
  assert.equal(storyData(computeWrapped(h, new Words([], new Set())), p, { text: "", by: "template" }).work?.commits, 2);
});

test("the catchphrase skips phrases everyone types", () => {
  const picked = pickCatchphrase([
    { text: "let me know", sessions: 100 },
    { text: "can you check", sessions: 90 },
    { text: "one by one", sessions: 80 },
  ]);
  assert.equal(picked?.text, "one by one");
  assert.equal(pickCatchphrase([{ text: "tell me what", sessions: 5 }]), null);
});

test("cards with too little behind them are left out", () => {
  const w = wrappedWith(["ok next", "fix it", "ok next"]);
  const d = storyData(w, pickPersonality(w), { text: "hi", by: "template" });
  assert.equal(d.topTypo, null);
  assert.equal(d.spellings, null);
  assert.equal(d.night, null); // all prompts in the afternoon
  assert.equal(d.streak, null);
  assert.equal(d.money, null);
});

test("late nights pick the Midnight Foreman", () => {
  const w = wrappedWith(Array.from({ length: 40 }, () => "make sure nothing breaks"), 2);
  assert.equal(pickPersonality(w).name, "The Midnight Foreman");
});

test("without the Claude CLI, the template letter is used", () => {
  const w = wrappedWith(["ok next", "ok next", "ok next", "fix it"]);
  const p = pickPersonality(w);
  const path = process.env.PATH;
  process.env.PATH = "/nonexistent";
  try {
    const letter = writeLetter(w, p);
    assert.equal(letter.by, "template");
    assert.equal(letter.text, templateLetter(w, p));
  } finally {
    process.env.PATH = path;
  }
});

test("text in the data can't break out of the page's script tag", () => {
  const w = wrappedWith(["ok next"]);
  const html = buildHtml(storyData(w, pickPersonality(w), { text: '</script><script>alert(1)</script>', by: "claude" }));
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("\\u003c/script>\\u003cscript>alert(1)"));
});

test("your own story file loads nothing from the internet; only the public page counts visits", () => {
  const w = wrappedWith(["ok next"]);
  const own = buildHtml(storyData(w, pickPersonality(w), { text: "hi", by: "template" }));
  assert.ok(!own.includes("_vercel") && !own.includes("og:image"));
  assert.ok(!/src="https?:/.test(own));
  // Its fonts are inside it, so it opens the same with no internet; only the
  // public page loads them from the site.
  assert.equal((own.match(/url\(data:font\/woff2;base64,/g) ?? []).length, 3);
  assert.ok(!own.includes("/fonts/"));
  const site = buildHtml(null);
  assert.ok(site.includes("/_vercel/insights/script.js"));
  assert.equal((site.match(/url\(\/fonts\/[\w-]+\.woff2\)/g) ?? []).length, 3);
});

test("the public player page carries no story, only where shared stories play", () => {
  const html = buildHtml(null, "https://example.com/</script>");
  const data = html.slice(html.indexOf('id="data">') + 10, html.indexOf("</script>", html.indexOf('id="data">')));
  assert.equal(data, "null");
  assert.ok(html.includes('"https://example.com/\\u003c/script>"'));
  // Hidden until a story opens, so the home page never flashes an empty player.
  assert.ok(html.includes('<main class="player" id="player" hidden>'));
  assert.ok(buildHtml(storyData(wrappedWith(["ok next"]), pickPersonality(wrappedWith([])), { text: "", by: "template" })).includes('<main class="player" id="player">'));
});

test("the home page's Copy button is set up before the script stops for a link with no story", () => {
  const script = readFileSync(new URL("../src/story/story.js", import.meta.url), "utf8");
  const stop = script.indexOf("await new Promise(() => {})");
  assert.ok(stop > 0);
  assert.ok(script.indexOf("[data-copy-command]") < stop);
  assert.ok(script.indexOf("function notify") < stop);
});

test("the finished page holds no private detail from the logs", () => {
  const h = emptyHarvest();
  h.privateNames.add("acmecorp");
  const secrets = ["Zentrix", "jane@acmecorp.com", "sk-ant-api03-SECRET99", "/Users/me/acmecorp/app.py", "acmecorp"];
  for (let s = 0; s < 6; s++) {
    ["ok check Zentrix", "mail jane@acmecorp.com", "use sk-ant-api03-SECRET99", "fix /Users/me/acmecorp/app.py", "acmecorp next", "ok next"].forEach(
      (text, i) => h.prompts.push({ agent: "claude", text, at: new Date(1_790_000_000_000 + s * 9e7 + i * 1000), session: `s${s}` }),
    );
  }
  const w = computeWrapped(h, new Words(h.privateNames, new Set("ok check mail use fix next".split(" "))));
  const p = pickPersonality(w);
  const html = buildHtml(storyData(w, p, { text: templateLetter(w, p), by: "template" }));
  const data = html.slice(html.indexOf('id="data">'), html.indexOf("</script>", html.indexOf('id="data">')));
  for (const secret of secrets) assert.ok(!data.toLowerCase().includes(secret.toLowerCase()), `leaked: ${secret}`);
  assert.ok(data.includes("ok next"));
});
