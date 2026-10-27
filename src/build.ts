import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoryData } from "./story.ts";

const STORY_DIR = join(import.meta.dirname, "story");

// One self-contained HTML file: fonts, script and data inlined, nothing
// fetched from the internet when it opens.
export function buildHtml(data: StoryData): string {
  const font = (file: string) => readFileSync(join(STORY_DIR, "fonts", file)).toString("base64");
  const fonts = [
    ["Unbounded", "unbounded-normal.woff2", "normal", "300 900"],
    ["Newsreader", "newsreader-normal.woff2", "normal", "300 700"],
    ["Newsreader", "newsreader-italic.woff2", "italic", "300 700"],
  ]
    .map(
      ([family, file, style, weight]) =>
        `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${font(file!)}) format("woff2");font-style:${style};font-weight:${weight};font-display:block}`,
    )
    .join("\n");
  // Escape "<" so no value can close the script tag it sits in.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return readFileSync(join(STORY_DIR, "index.html"), "utf8")
    .replace("/*FONTS*/", () => fonts)
    .replace("/*DATA*/", () => json)
    .replace("/*SCRIPT*/", () => readFileSync(join(STORY_DIR, "story.js"), "utf8"));
}
