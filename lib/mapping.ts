/**
 * Liest und schreibt Seiten-Einstellungen über config/field-mapping.json.
 * Vorhandene SEO-Felder (seo_title, seo_noindex) werden nur dort angefasst, wo sie im Schema existieren.
 */

import fieldMapping from "@/config/field-mapping.json";
import schemaGap from "@/config/schema-gap.json";
import { normalizeRobots, toStoredRobots } from "@/lib/robots";
import type { KeySpec, PagePatch, RobotsState, ScriptRecord } from "@/lib/types";

export type FieldMapping = typeof fieldMapping;

export function getFieldMapping(): FieldMapping {
  return fieldMapping;
}

export type PageSettings = RobotsState & {
  domain: string;
  realPath: string;
  redirectUrl: string;
  redirectDate: string;
  note: string;
  canonical: string;
  sitemap: boolean;
  tracking: Record<string, boolean>;
  seoTitle: string;
  hasSeoTitleField: boolean;
};

type SettingsObject = Record<string, unknown>;

function readSpec(source: SettingsObject, spec: KeySpec): unknown {
  if (Object.prototype.hasOwnProperty.call(source, spec.key) && source[spec.key] !== undefined && source[spec.key] !== null) {
    return source[spec.key];
  }
  for (const alias of spec.aliases ?? []) {
    if (source[alias] !== undefined && source[alias] !== null && source[alias] !== "") return source[alias];
  }
  return undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function settingsObject(content: Record<string, unknown> | undefined): SettingsObject {
  const field = fieldMapping.pageSettings.field;
  const raw = content?.[field];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ...(parsed as SettingsObject) };
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return { ...(raw as SettingsObject) };
  return {};
}

const TOGGLE_BY_SCRIPT = fieldMapping.builtinPageToggles as Record<string, keyof typeof fieldMapping.pageSettings.keys>;

export function readTracking(content: Record<string, unknown> | undefined, scripts: ScriptRecord[]): Record<string, boolean> {
  const source = settingsObject(content);
  const keys = fieldMapping.pageSettings.keys;
  const extras = readSpec(source, keys.trackingExtras);
  const extraMap = extras && typeof extras === "object" && !Array.isArray(extras) ? (extras as Record<string, unknown>) : {};
  const tracking: Record<string, boolean> = {};
  for (const script of scripts) {
    if (script.id === "termly") continue;
    const specName = TOGGLE_BY_SCRIPT[script.id];
    if (specName) {
      const value = readSpec(source, keys[specName]);
      if (value !== undefined) {
        tracking[script.id] = value === true || value === "true" || value === 1 || value === "1";
        continue;
      }
    }
    if (Object.prototype.hasOwnProperty.call(extraMap, script.id)) {
      const value = extraMap[script.id];
      tracking[script.id] = value === true || value === "true" || value === 1 || value === "1";
      continue;
    }
    tracking[script.id] = true;
  }
  return tracking;
}

export function readPageSettings(content: Record<string, unknown> | undefined, component: string | null, scripts: ScriptRecord[]): PageSettings {
  const source = settingsObject(content);
  const keys = fieldMapping.pageSettings.keys;
  const robots = normalizeRobots({
    index: readSpec(source, keys.index),
    noindex: readSpec(source, keys.noindex),
    follow: readSpec(source, keys.follow),
    nofollow: readSpec(source, keys.nofollow),
  });
  const indexMissing = readSpec(source, keys.index) === undefined && readSpec(source, keys.noindex) === undefined;
  const partnerField = fieldMapping.existingSchemaFields.partnerProgramNoindex;
  let index = robots.index;
  if (indexMissing && component === partnerField.component && content?.[partnerField.field] === true) {
    index = false;
  }
  const hasSeoTitleField = componentHasSeoTitle(component);
  const seoTitle = hasSeoTitleField ? asString(content?.[fieldMapping.existingSchemaFields.seoTitle]) : "";
  const domain = asString(readSpec(source, keys.domain)) || fieldMapping.defaultDomain;
  const redirectUrl = asString(readSpec(source, keys.redirectUrl));
  const redirectEnabledRaw = readSpec(source, keys.redirectEnabled);
  const redirectEnabled = redirectEnabledRaw === undefined ? Boolean(redirectUrl) : redirectEnabledRaw === true || redirectEnabledRaw === "true";
  return {
    domain,
    realPath: asString(readSpec(source, keys.realPath)),
    redirectUrl: redirectEnabled ? redirectUrl : "",
    redirectDate: redirectEnabled ? asString(readSpec(source, keys.redirectDate)) : "",
    note: asString(readSpec(source, keys.note)),
    canonical: asString(readSpec(source, keys.canonical)),
    index,
    follow: robots.follow,
    sitemap: readSpec(source, keys.sitemap) === undefined ? true : readSpec(source, keys.sitemap) === true || readSpec(source, keys.sitemap) === "true",
    tracking: readTracking(content, scripts),
    seoTitle,
    hasSeoTitleField,
  };
}

function componentHasSeoTitle(component: string | null): boolean {
  if (!component) return false;
  return !schemaGap.rootsWithoutSeoTitle.includes(component as (typeof schemaGap.rootsWithoutSeoTitle)[number]);
}

function writeSpec(target: SettingsObject, spec: KeySpec, value: unknown): void {
  target[spec.key] = value;
  for (const alias of spec.aliases ?? []) delete target[alias];
}

export function writePageSettings(content: Record<string, unknown>, settings: PageSettings, component: string | null): Record<string, unknown> {
  const next: Record<string, unknown> = { ...content };
  const current = settingsObject(content);
  const keys = fieldMapping.pageSettings.keys;
  const stored = toStoredRobots(settings);
  writeSpec(current, keys.realPath, settings.realPath);
  writeSpec(current, keys.domain, settings.domain);
  writeSpec(current, keys.redirectEnabled, Boolean(settings.redirectUrl));
  writeSpec(current, keys.redirectUrl, settings.redirectUrl);
  writeSpec(current, keys.redirectDate, settings.redirectUrl ? settings.redirectDate : "");
  writeSpec(current, keys.note, settings.note);
  writeSpec(current, keys.canonical, settings.canonical);
  writeSpec(current, keys.index, stored.index);
  writeSpec(current, keys.noindex, stored.noindex);
  writeSpec(current, keys.follow, stored.follow);
  writeSpec(current, keys.nofollow, stored.nofollow);
  writeSpec(current, keys.sitemap, settings.sitemap);

  const extras: Record<string, boolean> = {};
  for (const [scriptId, enabled] of Object.entries(settings.tracking)) {
    const specName = TOGGLE_BY_SCRIPT[scriptId];
    if (specName) writeSpec(current, keys[specName], enabled);
    else extras[scriptId] = enabled;
  }
  writeSpec(current, keys.trackingExtras, extras);
  next[fieldMapping.pageSettings.field] = current;

  const partner = fieldMapping.existingSchemaFields.partnerProgramNoindex;
  if (component === partner.component) next[partner.field] = !settings.index;
  if (settings.hasSeoTitleField) {
    next[fieldMapping.existingSchemaFields.seoTitle] = settings.seoTitle;
  }
  return next;
}

export function applyPatch(settings: PageSettings, patch: PagePatch, nowIso: string): PageSettings {
  const next: PageSettings = {
    ...settings,
    tracking: { ...settings.tracking },
    domain: patch.domain !== undefined ? patch.domain.trim() || fieldMapping.defaultDomain : settings.domain,
    realPath: patch.realPath !== undefined ? patch.realPath.trim() : settings.realPath,
    note: patch.note !== undefined ? patch.note : settings.note,
    canonical: patch.canonical !== undefined ? patch.canonical.trim() : settings.canonical,
    index: patch.index !== undefined ? patch.index : settings.index,
    follow: patch.follow !== undefined ? patch.follow : settings.follow,
    sitemap: patch.sitemap !== undefined ? patch.sitemap : settings.sitemap,
    seoTitle: patch.seoTitle !== undefined ? patch.seoTitle : settings.seoTitle,
  };
  if (patch.tracking) {
    for (const [id, enabled] of Object.entries(patch.tracking)) next.tracking[id] = enabled;
  }
  if (patch.redirectUrl !== undefined) {
    const url = patch.redirectUrl.trim();
    if (!url) {
      next.redirectUrl = "";
      next.redirectDate = "";
    } else if (settings.redirectUrl) {
      next.redirectUrl = url;
      next.redirectDate = settings.redirectDate || nowIso;
    } else {
      next.redirectUrl = url;
      next.redirectDate = nowIso;
    }
  }
  return next;
}

export function editorUrl(storyId: number): string {
  return `https://app.storyblok.com/#/me/spaces/${fieldMapping.spaceId}/stories/0/0/${storyId}`;
}
