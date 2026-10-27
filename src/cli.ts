#!/usr/bin/env node
import { homedir } from "node:os";
import { computeWrapped, type Wrapped } from "./moments.ts";
import { harvestClaude } from "./sources/claude.ts";
import { harvestCodex } from "./sources/codex.ts";
import { mergeHarvests } from "./types.ts";

// Day 1: print what the story will be built from. Day 2 turns it into slides.
const home = homedir();
const wrapped = computeWrapped(mergeHarvests([harvestClaude(home), harvestCodex(home)]));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(wrapped, null, 2));
} else {
  console.log(summary(wrapped));
}

function summary(w: Wrapped): string {
  const n = (x: number) => x.toLocaleString("en-US");
  const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines = [
    `Agent Wrapped (${w.totals.firstDay} to ${w.totals.lastDay})`,
    "",
    `${n(w.totals.prompts)} prompts over ${n(w.totals.activeDays)} days, ${n(w.totals.sessions)} sessions`,
    `Claude ${pct(w.loyalty.claudeShare)} · Codex ${pct(w.loyalty.codexShare)} · both on ${w.loyalty.bothAgentDays} days`,
    `Your agents worked ${n(w.totals.agentHours)} hours and used ${n(w.totals.tokens)} tokens`,
    `API value: at least ${usd(w.cost.atLeastUsd)} (exact part ${usd(w.cost.exactUsd)}, prices as of ${w.cost.pricesAsOf})`,
    w.cost.unpricedModels.length ? `  not priced: ${w.cost.unpricedModels.join(", ")}` : "",
    "",
    `Longest streak: ${w.rhythm.longestStreak?.days ?? 0} days (${w.rhythm.longestStreak?.from} to ${w.rhythm.longestStreak?.to})`,
    `Busiest day: ${w.rhythm.busiestDay?.day} with ${w.rhythm.busiestDay?.prompts} prompts`,
    `After midnight: ${n(w.rhythm.lateNight.prompts)} prompts, latest at ${w.rhythm.lateNight.latest ?? "never"}`,
    "",
    `Short prompts (3 words or fewer): ${pct(w.voice.shortShare)} · median ${w.voice.medianWords} words`,
    `Prompts with pasted text: ${pct(w.voice.pastedShare)}`,
    `Sent the same message twice: ${n(w.voice.doubleSends)} times`,
    `Words: ${Object.entries(w.voice.lexicon).map(([k, v]) => `${k} ${v}`).join(" · ")}`,
    "",
    "Top prompts:",
    ...w.voice.topPrompts.map((p) => `  ${p.count}× "${p.text}"`),
    "",
    "Catchphrases:",
    ...w.voice.catchphrases.map((p) => `  "${p.text}" in ${p.sessions} sessions`),
    "",
    "Typos:",
    ...w.voice.typos.map((t) => `  ${t.word}: ${t.spellings.map((s) => `${s.spelling} (${s.count})`).join(", ")}`),
    "",
    "Coverage:",
    ...w.coverage.map((c) => `  ${c.agent} ${c.source}: ${n(c.count)} (${c.from ?? "-"} to ${c.to ?? "-"})`),
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}
