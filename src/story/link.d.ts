import type { StoryData } from "../story.ts";

export function toLink(data: StoryData): unknown[];
export function fromLink(values: unknown[]): Partial<StoryData>;
