#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { buildHtml } from "./build.ts";
import { nameChapters } from "./chapters.ts";
import { localDay } from "./files.ts";
import { type Span, templateLetter, writeLetter } from "./letter.ts";
import { computeWrapped } from "./moments.ts";
import { pickPersonality } from "./personality.ts";
import { bold, choose, dim, line, step } from "./screen.ts";
import { readInBackground } from "./read-worker.ts";
import { storyData } from "./story.ts";
import { harvestSince, mergeHarvests } from "./types.ts";
import { Words } from "./words.ts";

const HELP = `Agent Wrapped 2026: your year with Claude Code, Codex and Cursor, played back in keyboard keys.

Usage: npx @shadevkumar/agent-wrapped [options]

  --last-month   Make the story from the last 30 days only
  --everything   Make it from everything so far, without asking
  --no-ai        Don't ask your claude command: a template letter, and chapters named by their top words
  --no-open      Write the story file without opening it
  --json         Print the numbers behind the story instead of making it
  -h, --help     Show this`;

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log(HELP);
  process.exit(0);
}
const home = homedir();
const useAi = !args.has("--no-ai");
const n = (x: number) => Math.round(x).toLocaleString("en-US");

line();
line(`  ${bold("Agent Wrapped 2026")}`);
line(`  ${dim("Reads your agents' logs on this computer. Nothing is uploaded.")}`);
line();

const span: Span = args.has("--last-month")
  ? "month"
  : args.has("--everything") || args.has("--json")
    ? "year"
    : await choose("Which stretch should your story cover?", [
        { label: "Everything so far", value: "year" as const },
        { label: "The last 30 days", value: "month" as const },
      ]);
const since = span === "month" ? new Date(Date.now() - 30 * 86_400_000) : null;

// All three are read at once; each line ticks when its agent is done.
const reading = (["claude", "codex", "cursor"] as const).map((source) => readInBackground(source, home));
const parts = [];
for (const [i, name] of ["Claude Code", "Codex", "Cursor"].entries()) {
  parts.push(
    await step(`Reading ${name}`, async () => (since ? harvestSince(await reading[i]!, since) : reading[i]!), (h) =>
      `${name}  ${dim(h.prompts.length ? `${n(h.prompts.length)} prompts` : "none on this computer")}`,
    ),
  );
}
const harvest = mergeHarvests(parts);
const words = new Words(harvest.privateNames);
const wrapped = computeWrapped(harvest, words);

if (args.has("--json")) {
  console.log(JSON.stringify(wrapped, null, 2));
  process.exit(0);
}
if (wrapped.totals.prompts === 0) {
  line();
  line(
    since
      ? "  No prompts from the last 30 days on this computer. Try it without --last-month."
      : "  No Claude Code, Codex or Cursor prompts on this computer, so there's no story yet.",
  );
  process.exit(1);
}

const personality = pickPersonality(wrapped);
if (useAi) line(`  ${dim("Your claude command writes the letter and names the chapters. It sees your stats and a few words, never your prompts.")}`);
const [letter, chapterNames] = await step(
  useAi ? "Writing your letter" : "Writing a short letter",
  () =>
    Promise.all([
      useAi ? writeLetter(wrapped, personality, span) : { text: templateLetter(wrapped, personality), by: "template" as const },
      nameChapters(wrapped.chapters, words, useAi),
    ]),
  ([l]) =>
    l.by === "claude"
      ? `Letter and chapters  ${dim("written by your Claude")}`
      : `Letter  ${dim(useAi ? "Claude wasn't available, so your agents wrote a shorter note" : "a short one, from a template")}`,
);

const dir = join(tmpdir(), "agent-wrapped");
mkdirSync(dir, { recursive: true });
const file = join(dir, `agent-wrapped-${localDay(new Date())}${span === "month" ? "-last-30-days" : ""}.html`);
writeFileSync(file, buildHtml(storyData(wrapped, personality, letter, chapterNames, span)));

const hours = wrapped.totals.agentHours >= 1 ? `, ${n(wrapped.totals.agentHours)} hours of agent work` : "";
line();
console.log(`  You are ${bold(personality.name)}.`);
console.log(`  ${n(wrapped.totals.prompts)} prompts${hours}.`);
line();
console.log(`  Your story: ${file}`);
if (!args.has("--no-open")) {
  console.log(`  ${dim("Opening it in your browser. Share it from the last screen; anyone with your link can watch it.")}`);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [file], { detached: true, stdio: "ignore" }).unref();
}
line();
