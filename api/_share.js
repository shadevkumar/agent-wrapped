// Short share links (served at /api/share). A page that shares a story sends its "v2." link code
// here and gets back a short name for it; /s/<name> plays it. The code holds
// exactly what the story's cards show, nothing else from anyone's logs.
//
// Names come from the story itself, so the same story always gets the same
// link, and saving it twice changes nothing.

import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { head, put } from "@vercel/blob";
import { fromLink } from "../src/story/link.js";

const MAX_LENGTH = 8_000; // a story's code is about 1,000 characters
const NAME = /^[0-9A-Za-z]{10}$/;
// Your own story file opens from your computer, not from this site.
const ANYONE = { "Access-Control-Allow-Origin": "*" };
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function nameFor(code) {
  let n = BigInt(`0x${createHash("sha256").update(code).digest("hex")}`);
  let name = "";
  for (let i = 0; i < 10; i++) {
    name += ALPHABET[Number(n % 62n)];
    n /= 62n;
  }
  return name;
}

// A "v2." code that opens as a story the player can play.
export function isStory(code) {
  if (code.length > MAX_LENGTH || !/^v2\.[\w-]+$/.test(code)) return false;
  try {
    const values = JSON.parse(inflateRawSync(Buffer.from(code.slice(3), "base64url"), { maxOutputLength: 100_000 }).toString());
    const story = Array.isArray(values) ? fromLink(values) : null;
    return typeof story?.prompts === "number" && typeof story.personality?.name === "string";
  } catch {
    return false;
  }
}

export async function POST(request) {
  const code = (await request.text()).trim();
  if (!isStory(code)) return new Response("That isn't a story.", { status: 400, headers: ANYONE });
  const name = nameFor(code);
  await put(`s/${name}`, code, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "text/plain" });
  return Response.json({ name }, { headers: ANYONE });
}

export async function GET(request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const saved = NAME.test(name) ? await head(`s/${name}`).catch(() => null) : null;
  if (!saved) return new Response("No story by that name.", { status: 404, headers: ANYONE });
  const code = await (await fetch(saved.url)).text();
  // A name always means the same story, so it can be kept for good.
  return new Response(code, {
    headers: { ...ANYONE, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
