#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { buildHtml } from "./build.ts";
import { localDay } from "./files.ts";
import { templateLetter, writeLetter } from "./letter.ts";
import { computeWrapped } from "./moments.ts";
import { pickPersonality } from "./personality.ts";
import { harvestClaude } from "./sources/claude.ts";
import { harvestCodex } from "./sources/codex.ts";
import { storyData } from "./story.ts";
import { mergeHarvests } from "./types.ts";

const args = new Set(process.argv.slice(2));
const home = homedir();

console.log("Reading your Claude Code and Codex logs. Nothing leaves this computer.");
const wrapped = computeWrapped(mergeHarvests([harvestClaude(home), harvestCodex(home)]));

if (args.has("--json")) {
  console.log(JSON.stringify(wrapped, null, 2));
  process.exit(0);
}
if (wrapped.totals.prompts === 0) {
  console.log("No Claude Code or Codex prompts found on this computer, so there's no story yet.");
  process.exit(1);
}

const personality = pickPersonality(wrapped);
let letter;
if (args.has("--no-ai")) {
  letter = { text: templateLetter(wrapped, personality), by: "template" as const };
} else {
  console.log("Asking your Claude to write you a letter. It sees your stats only, never your prompts.");
  letter = writeLetter(wrapped, personality);
  if (letter.by === "template") console.log("Claude wasn't available, so your agents wrote a shorter note instead.");
}

const dir = join(tmpdir(), "agent-wrapped");
mkdirSync(dir, { recursive: true });
const file = join(dir, `agent-wrapped-${localDay(new Date())}.html`);
writeFileSync(file, buildHtml(storyData(wrapped, personality, letter)));

console.log(`\nYou are ${personality.name}. ${wrapped.totals.prompts.toLocaleString("en-US")} prompts, ${Math.round(wrapped.totals.agentHours)} hours of agent work.`);
console.log(`Your story is ready: ${file}`);
if (!args.has("--no-open")) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [file], { detached: true, stdio: "ignore" }).unref();
}
