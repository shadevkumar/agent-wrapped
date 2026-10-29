import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

// Asks the person's own `claude` command, with no tools, no project
// instructions and nothing saved. Resolves to its reply, or null if Claude
// isn't installed, fails or takes too long.
export function askClaude(system: string, input: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const args = [
      "-p",
      "--model", "sonnet",
      "--tools", "",
      "--strict-mcp-config",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--setting-sources", "",
      "--system-prompt", system,
    ];
    // Run outside any project so no project instructions are loaded.
    const child = spawn("claude", args, { cwd: tmpdir(), stdio: ["pipe", "pipe", "ignore"], timeout: timeoutMs });
    let out = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (out += chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 ? out : null));
    child.stdin.on("error", () => {}); // Claude missing: the "error" above answers
    child.stdin.end(input);
  });
}
