/**
 * Katalog ersetzen, ohne Snippets auszuführen.
 * Termly wird ergänzt, falls der gespeicherte Katalog ihn nicht enthält.
 */

import { initialScripts } from "@/lib/mock/fixtures";
import { normalizeOrder, TERMLY_ID, validateScriptDraft } from "@/lib/order";
import type { ScriptRecord } from "@/lib/types";

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function ensureTermly(scripts: ScriptRecord[]): ScriptRecord[] {
  if (scripts.some((script) => script.id === TERMLY_ID)) return normalizeOrder(scripts);
  const termly = initialScripts.find((script) => script.id === TERMLY_ID);
  return normalizeOrder(termly ? [termly, ...scripts] : scripts);
}

export function replaceScripts(scripts: ScriptRecord[]): ScriptRecord[] {
  const prepared = ensureTermly(scripts).map((script) => {
    if (script.id === TERMLY_ID) {
      return { ...script, required: true, category: "Notwendig" as const, active: true, type: "consent" as const };
    }
    const { snippet, ...rest } = script;
    const capped = typeof snippet === "string" && snippet.length > 50_000 ? snippet.slice(0, 50_000) : snippet;
    return { ...rest, snippet: capped ?? "", required: false };
  });
  for (const script of prepared) {
    const error = validateScriptDraft(script, script.id === TERMLY_ID ? script : undefined);
    if (error) throw new ValidationError(`${script.name}: ${error}`);
  }
  return prepared;
}
