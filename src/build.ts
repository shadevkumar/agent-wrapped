import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoryData } from "./story.ts";

const STORY_DIR = join(import.meta.dirname, "story");

// The public page that plays shared stories.
export const PLAYER_URL = "https://agent-wrapped.shadev.space/";

// Only on the public page: how a shared link looks in a post, and Vercel's
// page counts. The story sits after the "#", which browsers never send to a
// server; the counts drop it anyway before anything is sent.
const PUBLIC_HEAD = `<meta name="description" content="A year with AI coding agents, played back in keyboard keys. Tap to watch.">
<meta property="og:title" content="Agent Wrapped 2026">
<meta property="og:description" content="A year with AI coding agents, played back in keyboard keys. Tap to watch.">
<meta property="og:image" content="${PLAYER_URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${PLAYER_URL}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="preload" href="/fonts/geist-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/newsreader-italic.woff2" as="font" type="font/woff2" crossorigin>
<script>
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.va("beforeSend", (event) => {
  const url = new URL(event.url);
  url.hash = "";
  return { ...event, url: url.toString() };
});
</script>
<script defer src="/_vercel/insights/script.js"></script>`;

// On the public page with no story in its link, the home page shows as soon
// as its title's font is in, without waiting for the page's script to run,
// and never shows its boxes before its words.
const HOME_FIRST = `<script>
if (!location.hash) {
  document.documentElement.classList.add("home");
  document.fonts.load("480 1em Geist").finally(() => document.documentElement.classList.add("fonts-in"));
}
</script>`;

// One self-contained HTML file: fonts, script and data inlined, nothing
// fetched from the internet when it opens. Without data it is the public
// player, which reads the story from its link; it loads the fonts as
// separate files from /fonts/, so the page itself is small and phones show
// it sooner, and the fonts stay cached between visits.
export function buildHtml(data: StoryData | null, playerUrl = PLAYER_URL): string {
  // link.js is a module of its own for the site build; on the page it runs inline.
  const link = readFileSync(join(STORY_DIR, "link.js"), "utf8").replace(/^export /gm, "");
  const script = `${link}\n${readFileSync(join(STORY_DIR, "story.js"), "utf8")}`;
  const font = (file: string) =>
    data ? `data:font/woff2;base64,${readFileSync(join(STORY_DIR, "fonts", file)).toString("base64")}` : `/fonts/${file}`;
  const fonts = [
    ["Geist", "geist-normal.woff2", "normal", "100 900"],
    ["Newsreader", "newsreader-normal.woff2", "normal", "300 700"],
    ["Newsreader", "newsreader-italic.woff2", "italic", "300 700"],
  ]
    .map(
      ([family, file, style, weight]) =>
        `@font-face{font-family:"${family}";src:url(${font(file!)}) format("woff2");font-style:${style};font-weight:${weight};font-display:block}`,
    )
    .join("\n");
  // Escape "<" so no value can close the script tag it sits in.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return readFileSync(join(STORY_DIR, "index.html"), "utf8")
    .replace("<!--HEAD-->", () => (data ? "" : PUBLIC_HEAD))
    .replace("<!--HOME-->", () => (data ? "" : HOME_FIRST))
    // The public page doesn't know yet whether its link holds a story, so its
    // player starts hidden instead of flashing an empty frame.
    .replace('<main class="player" id="player">', (tag) => (data ? tag : '<main class="player" id="player" hidden>'))
    .replace("/*FONTS*/", () => fonts)
    .replace("/*DATA*/", () => json)
    .replace("/*PLAYER_URL*/", () => JSON.stringify(playerUrl).replace(/</g, "\\u003c"))
    .replace("/*SCRIPT*/", () => script);
}
