// Writes the public site: the player page, which plays stories shared by
// link, and the fonts it loads from /fonts/. site/og.png (the picture posts
// show) is made from site/og.html.
import { cpSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { buildHtml } from "../src/build.ts";
import { SHADEVS_STORY } from "./shadevs-story.ts";

// Packed the same way the page packs a shared story.
const featured = `#v1.${deflateRawSync(JSON.stringify(SHADEVS_STORY)).toString("base64url")}`;
const html = buildHtml(null);
if (!html.includes('href="#featured"')) throw new Error("The home page lost its link to Shadev's story.");
writeFileSync("site/index.html", html.replace('href="#featured"', `href="${featured}"`));
cpSync("src/story/fonts", "site/fonts", { recursive: true, filter: (src) => !src.endsWith(".txt") });
console.log("Wrote site/index.html and site/fonts");
