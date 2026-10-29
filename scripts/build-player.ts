// Writes the public site: the player page, which plays stories shared by
// link, and the fonts it loads from /fonts/. site/og.png (the picture posts
// show) is made from site/og.html.
import { cpSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { buildHtml } from "../src/build.ts";
import { toLink } from "../src/story/link.js";
import { SHADEVS_STORY } from "./shadevs-story.ts";

// Packed the same way the page packs a shared story. FEATURED_STORY, set on
// Vercel, replaces it with a story link's #v2. part, so Shadev can change
// the story the home page plays without a commit.
const featured = process.env.FEATURED_STORY?.trim() || `#v2.${deflateRawSync(JSON.stringify(toLink(SHADEVS_STORY))).toString("base64url")}`;
if (!/^#v2\.[\w-]+$/.test(featured)) throw new Error("FEATURED_STORY should be a story link's #v2. part.");
const html = buildHtml(null);
if (!html.includes('href="#featured"')) throw new Error("The home page lost its link to Shadev's story.");
writeFileSync("site/index.html", html.replace('href="#featured"', `href="${featured}"`));
cpSync("src/story/fonts", "site/fonts", { recursive: true, filter: (src) => !src.endsWith(".txt") });
console.log("Wrote site/index.html and site/fonts");
