/**
 * Dateigestützter Mock-Speicher für den lokalen Betrieb ohne Storyblok-Token.
 * Liegt unter .data/ und wird nicht versioniert.
 */

import fs from "node:fs";
import path from "node:path";
import { initialManuals, initialScripts, initialStories } from "@/lib/mock/fixtures";
import type { ManualRedirect, ScriptRecord, StoryRecord } from "@/lib/types";

export type MockState = {
  stories: StoryRecord[];
  scripts: ScriptRecord[];
  manuals: ManualRedirect[];
};

const filePath = path.join(process.cwd(), ".data", "mock-store.json");

export function seedState(): MockState {
  return {
    stories: structuredClone(initialStories),
    scripts: structuredClone(initialScripts),
    manuals: structuredClone(initialManuals),
  };
}

export function readMockState(): MockState {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as MockState;
    if (!Array.isArray(parsed.stories) || !Array.isArray(parsed.scripts)) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
}

export function writeMockState(state: MockState): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}
