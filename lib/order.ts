/**
 * Lade-Reihenfolge des Scriptkatalogs.
 * Termly bleibt fest an Position 1, aktiv und in der Kategorie Notwendig.
 * Snippets werden nur als Text umsortiert, nie ausgeführt.
 */

import { COOKIE_CATEGORIES, SCRIPT_TYPES, type CookieCategory, type ScriptRecord, type ScriptType } from "@/lib/types";

export const TERMLY_ID = "termly";

export function isTermly(script: Pick<ScriptRecord, "id">): boolean {
  return script.id === TERMLY_ID;
}

export function normalizeOrder(scripts: ScriptRecord[]): ScriptRecord[] {
  const termly = scripts.find((script) => script.id === TERMLY_ID);
  const rest = scripts
    .filter((script) => script.id !== TERMLY_ID)
    .slice()
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "de"));
  const ordered = [...(termly ? [termly] : []), ...rest];
  return ordered.map((script, index) => {
    if (script.id === TERMLY_ID) {
      return {
        ...script,
        order: index + 1,
        required: true,
        active: true,
        category: "Notwendig",
        type: "consent",
      };
    }
    return { ...script, order: index + 1, required: false };
  });
}

/** Verschiebt ein Script. Index 0 ist Termly und wird nicht belegt. */
export function moveScript(scripts: ScriptRecord[], id: string, toIndex: number): ScriptRecord[] {
  const current = normalizeOrder(scripts);
  if (id === TERMLY_ID) return current;
  const from = current.findIndex((script) => script.id === id);
  if (from <= 0) return current;
  const target = Math.max(1, Math.min(current.length - 1, toIndex));
  if (from === target) return current;
  const next = current.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return normalizeOrder(next.map((script, index) => ({ ...script, order: index + 1 })));
}

export function removeScript(scripts: ScriptRecord[], id: string): ScriptRecord[] {
  if (id === TERMLY_ID) return normalizeOrder(scripts);
  return normalizeOrder(scripts.filter((script) => script.id !== id));
}

const SAFE_URL = /^https?:\/\//i;

export function validateScriptDraft(input: Partial<ScriptRecord>, existing?: ScriptRecord): string | null {
  const name = (input.name ?? "").trim();
  const details = (input.details ?? "").trim();
  const reason = (input.reason ?? "").trim();
  const note = (input.note ?? "").trim();
  const websiteUrl = (input.websiteUrl ?? "").trim();
  const sourceText = (input.sourceText ?? "").trim();
  if (!name) return "Bitte Scriptnamen eintragen.";
  if (!details) return "Bitte Details eintragen.";
  if (!reason) return "Bitte Implementierungsgrund eintragen.";
  if (!note) return "Bitte eine Notiz eintragen.";
  if (!websiteUrl && !sourceText) return "Website oder Quellenangabe ist erforderlich.";
  if (websiteUrl && !SAFE_URL.test(websiteUrl)) return "Bitte eine gültige http(s)-Adresse eintragen.";
  if (websiteUrl) {
    try {
      const url = new URL(websiteUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "Bitte eine gültige http(s)-Adresse eintragen.";
      }
    } catch {
      return "Bitte eine gültige http(s)-Adresse eintragen.";
    }
  }
  const category = input.category ?? existing?.category;
  if (!category || !COOKIE_CATEGORIES.includes(category)) return "Cookie-Kategorie ist ungültig.";
  const type = input.type ?? existing?.type ?? "analytics";
  if (!SCRIPT_TYPES.includes(type as ScriptType)) return "Einordnung ist ungültig.";
  if (existing?.required && category !== "Notwendig") return "Termly bleibt in der Kategorie Notwendig.";
  return null;
}

export function upsertScript(scripts: ScriptRecord[], draft: ScriptRecord): ScriptRecord[] {
  const error = validateScriptDraft(draft, scripts.find((script) => script.id === draft.id));
  if (error) throw new Error(error);
  const existing = scripts.find((script) => script.id === draft.id);
  if (existing?.required) {
    const locked: ScriptRecord = {
      ...existing,
      ...draft,
      id: TERMLY_ID,
      name: existing.name,
      category: "Notwendig",
      active: true,
      required: true,
      type: "consent",
    };
    return normalizeOrder(scripts.map((script) => (script.id === locked.id ? locked : script)));
  }
  const next = existing
    ? scripts.map((script) => (script.id === draft.id ? { ...draft, required: false } : script))
    : [...scripts, { ...draft, required: false, order: draft.order || scripts.length + 1 }];
  return normalizeOrder(next);
}

export type ConsentMap = Partial<Record<CookieCategory, boolean>>;

/**
 * Scripts, die die Website laden darf.
 * Termly zuerst. Global aus = nicht laden. Seite aus = nicht laden.
 * Nicht-notwendige Kategorien nur bei Einwilligung.
 */
export function scriptsToLoad(catalog: ScriptRecord[], pageToggles: Record<string, boolean>, consent: ConsentMap): ScriptRecord[] {
  return normalizeOrder(catalog).filter((script) => {
    if (!script.active) return false;
    if (script.id === TERMLY_ID) return true;
    if (pageToggles[script.id] === false) return false;
    if (script.category === "Notwendig") return true;
    return consent[script.category] === true;
  });
}
