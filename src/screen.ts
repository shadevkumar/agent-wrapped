import { emitKeypressEvents } from "node:readline";

// What the command shows while it runs, on stderr, so --json output stays
// clean. In a terminal each step updates in place; piped, it prints plain lines.
const out = process.stderr;
const live = out.isTTY === true;
const color = live && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
export const dim = paint("2");
export const bold = paint("1");
const green = paint("32");

export function line(text = "") {
  out.write(`${text}\n`);
}

function redraw(text: string) {
  if (live) out.write(`\r\x1b[2K${text}`);
}

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Shows `doing` while `work` runs (with a spinner when the work lets the
// screen redraw), then a tick and what was done.
export async function step<T>(doing: string, work: () => T | Promise<T>, done: (result: T) => string): Promise<T> {
  const started = Date.now();
  let frame = 0;
  redraw(`  ${dim(FRAMES[0]!)} ${doing}`);
  const spin = live ? setInterval(() => redraw(`  ${dim(FRAMES[++frame % FRAMES.length]!)} ${doing}`), 80) : undefined;
  // Let the first frame draw before work that holds the process.
  await new Promise((r) => setImmediate(r));
  try {
    const result = await work();
    const seconds = (Date.now() - started) / 1000;
    const text = `  ${green("✓")} ${done(result)}${seconds >= 2 ? dim(`  ${seconds.toFixed(0)}s`) : ""}`;
    if (live) redraw(`${text}\n`);
    else line(text);
    return result;
  } finally {
    clearInterval(spin);
  }
}

// A choice made with the arrow keys and Enter. Without a terminal to ask in,
// the first option is the answer.
export async function choose<T>(question: string, options: { label: string; value: T }[]): Promise<T> {
  const input = process.stdin;
  if (!live || !input.isTTY) return options[0]!.value;
  let at = 0;
  const draw = () =>
    redraw(`  ${bold("?")} ${question}  ${options.map((o, i) => (i === at ? bold(`❯ ${o.label}`) : dim(`  ${o.label}`))).join("  ")}  ${dim("← → Enter")}`);
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  draw();
  const value = await new Promise<T>((resolve) => {
    const onKey = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        input.setRawMode(false);
        line();
        process.exit(130);
      }
      if (["left", "up"].includes(key.name ?? "")) at = (at + options.length - 1) % options.length;
      else if (["right", "down", "tab"].includes(key.name ?? "")) at = (at + 1) % options.length;
      else if (key.name === "return") {
        input.off("keypress", onKey);
        resolve(options[at]!.value);
        return;
      }
      draw();
    };
    input.on("keypress", onKey);
  });
  input.setRawMode(false);
  input.pause();
  redraw(`  ${green("✓")} ${question}  ${dim(options[at]!.label)}\n`);
  return value;
}
