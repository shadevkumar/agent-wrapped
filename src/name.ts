import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readJson } from "./files.ts";

// The first name the story greets you by: from your Claude account, else from
// git. Only the first word, so a full name never ends up on a card.
export function firstName(home: string): string | null {
  const account = readJson(join(home, ".claude.json"))?.oauthAccount;
  for (const full of [account?.displayName, account?.fullName, gitName(home)]) {
    const first = typeof full === "string" ? full.trim().split(/\s+/)[0]!.replace(/\p{C}/gu, "") : "";
    if (first) return first.slice(0, 24);
  }
  return null;
}

function gitName(home: string): string | null {
  try {
    return execFileSync("git", ["config", "--global", "user.name"], { env: { ...process.env, HOME: home }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null; // no git, or no name set
  }
}
