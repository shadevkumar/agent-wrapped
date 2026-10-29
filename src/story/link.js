// A shared story travels inside its link, after "#v2.". To keep links short,
// a link holds only the values, in the order below, never the field names.
// Fields are only ever added at the end of a list, so an older link still
// reads: a field it doesn't have comes back missing.
//
// The page and the site build both use this file.

const listOf = (fields) => ({ list: fields });

const FIELDS = [
  ["range", ["from", "to"]],
  "prompts",
  "activeDays",
  "sessions",
  ["topTypo", ["spelling", "word", "count"]],
  ["spellings", ["word", "spellings", "ways"]],
  ["slip", ["meant", "hit", "count"]],
  ["topPrompts", listOf(["text", "count"])],
  ["catchphrase", ["text", "sessions"]],
  ["night", ["latest", "prompts"]],
  ["streak", ["days", "from", "to"]],
  ["agents", ["claude", "codex", "cursor", "hours", "bothDays"]],
  ["money", ["atLeastUsd", "pricesAsOf"]],
  ["talk", [["nickname", ["word", "count"]], "please", "thanks", "checkIns"]],
  ["work", ["since", "tests", "commits", "stops", "languages"]],
  ["chapters", listOf(["from", "to", "name"])],
  ["personality", ["name", "line", "traits"]],
  ["letter", ["text"]],
  "period",
  ["shipped", ["since", "pushes", "prs", "deploys", ["biggestWeek", ["from", "to", "commits"]]]],
];

export function toLink(data, fields = FIELDS) {
  return fields.map((f) => {
    const [key, inner] = typeof f === "string" ? [f] : f;
    const value = data[key];
    if (value === undefined || value === null) return null;
    if (!inner) return value;
    return inner.list ? value.map((item) => toLink(item, inner.list)) : toLink(value, inner);
  });
}

export function fromLink(values, fields = FIELDS) {
  const data = {};
  fields.forEach((f, i) => {
    const [key, inner] = typeof f === "string" ? [f] : f;
    const value = values[i];
    if (value === undefined) return;
    if (value === null || !inner) data[key] = value;
    else data[key] = inner.list ? value.map((item) => fromLink(item, inner.list)) : fromLink(value, inner);
  });
  return data;
}
