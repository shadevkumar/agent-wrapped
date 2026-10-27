import assert from "node:assert/strict";
import { test } from "node:test";
import { computeWrapped } from "../src/moments.ts";
import { emptyHarvest } from "../src/types.ts";
import { Words } from "../src/words.ts";

// Private details are repeated often enough to reach every quote list
// (top prompts, catchphrases, typos). None may appear in the output.
const SECRETS = [
  "sk-ant-api03-AbCdEf1234567890",
  "AKIAIOSFODNN7EXAMPLE",
  "ghp_16C7e42F292c6912E7710c838347Ae178B4a",
  "jane.doe@acmecorp.com",
  "https://acmecorp.com/deals/42",
  "/Users/me/acmecorp/backend/billing.py",
  "acmecorp",
  "Zentrix",
  "zentrix",
  "Priya",
];

test("no private detail reaches the shareable output", () => {
  const dict = new Set("ok check the deal for and ask about send to next please fix".split(" "));
  const h = emptyHarvest();
  h.privateNames.add("acmecorp");
  const lines = [
    "ok check the Zentrix deal",
    "ask Priya about Zentrix",
    "send sk-ant-api03-AbCdEf1234567890 to AKIAIOSFODNN7EXAMPLE",
    "fix ghp_16C7e42F292c6912E7710c838347Ae178B4a",
    "ask jane.doe@acmecorp.com about https://acmecorp.com/deals/42",
    "fix /Users/me/acmecorp/backend/billing.py",
    "acmecorp next",
    "please fix", // safe, must survive so the test isn't empty
  ];
  for (let s = 0; s < 6; s++) {
    lines.forEach((text, i) => h.prompts.push({ agent: "claude", text, at: new Date(1_790_000_000_000 + s * 1e7 + i), session: `s${s}` }));
  }

  const out = JSON.stringify(computeWrapped(h, new Words(h.privateNames, dict)));
  for (const secret of SECRETS) assert.ok(!out.includes(secret), `leaked: ${secret}`);
  assert.ok(out.includes('"please fix"'), "safe prompt should still appear");
});
