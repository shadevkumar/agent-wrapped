// Writes the public site: the player page, which plays stories shared by
// link. site/og.png (the picture posts show) is made from site/og.html.
import { writeFileSync } from "node:fs";
import { buildHtml } from "../src/build.ts";

writeFileSync("site/index.html", buildHtml(null));
console.log("Wrote site/index.html");
