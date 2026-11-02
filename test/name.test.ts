import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { firstName } from "../src/name.ts";
import { tempHome, writeFile } from "./helpers.ts";

test("the story greets you by the first word of your Claude account name", () => {
  const home = tempHome();
  writeFile(join(home, ".claude.json"), JSON.stringify({ oauthAccount: { displayName: "  Ada\u0007 Lovelace ", fullName: "Augusta Ada King" } }));
  writeFile(join(home, ".gitconfig"), "[user]\n\tname = Someone Else\n");
  assert.equal(firstName(home), "Ada");
});

test("without a Claude account name it uses git's, and with neither there's no name", () => {
  const home = tempHome();
  writeFile(join(home, ".claude.json"), JSON.stringify({ oauthAccount: { displayName: "   " } }));
  writeFile(join(home, ".gitconfig"), "[user]\n\tname = Grace Hopper\n");
  assert.equal(firstName(home), "Grace");
  assert.equal(firstName(tempHome()), null);
});
