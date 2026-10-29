import { parentPort, Worker, workerData } from "node:worker_threads";
import { harvestClaude } from "./sources/claude.ts";
import { harvestCodex } from "./sources/codex.ts";
import { harvestCursor } from "./sources/cursor.ts";
import type { Harvest } from "./types.ts";

// Reads one agent's logs on a thread of its own, so the screen keeps moving
// while a large log is read, and all the agents are read at once.
const SOURCES = { claude: harvestClaude, codex: harvestCodex, cursor: harvestCursor };
export type Source = keyof typeof SOURCES;

export function readInBackground(source: Source, home: string): Promise<Harvest> {
  return new Promise((resolve, reject) => {
    // This same file, as .ts in development and .js once built.
    const worker = new Worker(new URL(import.meta.url), { workerData: { source, home } });
    worker.once("message", resolve);
    worker.once("error", reject);
  });
}

if (parentPort && workerData?.source) {
  parentPort.postMessage(SOURCES[workerData.source as Source](workerData.home));
}
