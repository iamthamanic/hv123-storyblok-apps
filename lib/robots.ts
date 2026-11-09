/**
 * Index/NoIndex und Follow/NoFollow schließen sich gegenseitig aus.
 * Gespeichert wird immer ein Paar, nie beide Seiten gleichzeitig true.
 */

import type { RobotsState } from "@/lib/types";

export class RobotsConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RobotsConflictError";
  }
}

export function assertMutuallyExclusive(flags: {
  index?: boolean;
  noindex?: boolean;
  follow?: boolean;
  nofollow?: boolean;
}): void {
  if (flags.index === true && flags.noindex === true) {
    throw new RobotsConflictError("Index und NoIndex schließen sich aus.");
  }
  if (flags.follow === true && flags.nofollow === true) {
    throw new RobotsConflictError("Follow und NoFollow schließen sich aus.");
  }
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

/**
 * Liest Rohwerte. Widerspruch (beide true) wird als restriktiv aufgelöst
 * und über `conflict` gemeldet, damit der nächste Schreibvorgang das Paar bereinigt.
 * Fehlt jede Angabe, gilt Index und Follow (öffentliche Standardseite).
 */
export function normalizeRobots(raw: {
  index?: unknown;
  noindex?: unknown;
  follow?: unknown;
  nofollow?: unknown;
}): RobotsState & { conflict: boolean } {
  const index = asBool(raw.index);
  const noindex = asBool(raw.noindex);
  const follow = asBool(raw.follow);
  const nofollow = asBool(raw.nofollow);
  const indexConflict = index === true && noindex === true;
  const followConflict = follow === true && nofollow === true;

  let nextIndex = true;
  if (indexConflict) nextIndex = false;
  else if (noindex === true || index === false) nextIndex = false;
  else if (index === true) nextIndex = true;

  let nextFollow = true;
  if (followConflict) nextFollow = false;
  else if (nofollow === true || follow === false) nextFollow = false;
  else if (follow === true) nextFollow = true;

  return { index: nextIndex, follow: nextFollow, conflict: indexConflict || followConflict };
}

export function applyRobotsChoice(current: RobotsState, choice: Partial<RobotsState>): RobotsState {
  return {
    index: choice.index ?? current.index,
    follow: choice.follow ?? current.follow,
  };
}

/** Kanonisches Speicherpaar. Genau eines von index/noindex und follow/nofollow ist true. */
export function toStoredRobots(state: RobotsState): {
  index: boolean;
  noindex: boolean;
  follow: boolean;
  nofollow: boolean;
} {
  return {
    index: state.index,
    noindex: !state.index,
    follow: state.follow,
    nofollow: !state.follow,
  };
}
