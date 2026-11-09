/**
 * Datenquelle der beiden Apps: Mock-Datei, Personal Access Token oder OAuth-Session.
 */

import fieldMapping from "@/config/field-mapping.json";
import schemaGap from "@/config/schema-gap.json";
import { assemblePages, pageRefsOf } from "@/lib/assemble";
import { componentLabels } from "@/lib/labels";
import { fetchHttpStatus, mapPool } from "@/lib/link-check";
import { applyPatch, readPageSettings, writePageSettings, type PageSettings } from "@/lib/mapping";
import { mockLinkStatus, initialScripts } from "@/lib/mock/fixtures";
import { readMockState, seedState, writeMockState, type MockState } from "@/lib/mock/store";
import { explainPageChange } from "@/lib/page-rules";
import { ensureTermly, replaceScripts } from "@/lib/scripts";
import { StoryblokClient, StoryblokError } from "@/lib/storyblok/client";
import type { ManualRedirect, PagePatch, PageRecord, ScriptRecord, StoryRecord } from "@/lib/types";
import { normalizeLocation } from "@/lib/redirects";

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export type AppRepository = {
  mode: "mock" | "pat" | "oauth";
  listPages: () => Promise<PageRecord[]>;
  updatePage: (id: string, patch: PagePatch) => Promise<PageRecord>;
  createRedirect: (input: { source: string; target: string; note?: string }) => Promise<PageRecord>;
  checkLinks: () => Promise<PageRecord[]>;
  listScripts: () => Promise<ScriptRecord[]>;
  saveScripts: (scripts: ScriptRecord[]) => Promise<ScriptRecord[]>;
  reset: () => Promise<void>;
};

type StatusEntry = { status: number | null; at: number };
const liveStatusCache = new Map<string, StatusEntry>();
const STATUS_TTL_MS = 5 * 60_000;
const CHECK_LINKS_BUDGET_MS = 45_000;
const CHECK_LINKS_CONCURRENCY = 4;

function cachedStatus(href: string): number | null {
  const entry = liveStatusCache.get(href);
  if (!entry) return null;
  if (Date.now() - entry.at > STATUS_TTL_MS) return null;
  return entry.status;
}

function pagesFrom(state: Pick<MockState, "stories" | "scripts" | "manuals">, statusFor: (sourceId: string, href: string) => number | null): PageRecord[] {
  return assemblePages({
    stories: state.stories,
    manuals: state.manuals,
    scripts: ensureTermly(state.scripts),
    labels: componentLabels,
    statusFor,
  });
}

function rowsOf(pages: PageRecord[]) {
  return pageRefsOf(pages);
}

export class MockRepository implements AppRepository {
  mode = "mock" as const;

  private state(): MockState {
    return readMockState();
  }

  async listPages(): Promise<PageRecord[]> {
    const state = this.state();
    return pagesFrom(state, mockLinkStatus);
  }

  async updatePage(id: string, patch: PagePatch): Promise<PageRecord> {
    const state = this.state();
    const now = new Date().toISOString();
    if (id.startsWith("manual:")) {
      const manualId = id.slice("manual:".length);
      const manual = state.manuals.find((item) => item.id === manualId);
      if (!manual) throw new AppError("Redirect nicht gefunden.", 404);
      const pages = pagesFrom(state, mockLinkStatus);
      const current = pages.find((page) => page.id === id);
      if (!current) throw new AppError("Redirect nicht gefunden.", 404);
      const next = applyPatch(pageToSettings(current), patch, now);
      const error = explainPageChange(id, next, rowsOf(pages));
      if (error) throw new AppError(error);
      manual.source = next.realPath;
      manual.target = next.redirectUrl;
      manual.note = next.note;
      manual.domain = next.domain;
      manual.updatedAt = now;
      if (!manual.createdAt) manual.createdAt = now;
      writeMockState(state);
      return (await this.listPages()).find((page) => page.id === id)!;
    }
    const story = state.stories.find((item) => String(item.id) === id);
    if (!story) throw new AppError("Seite nicht gefunden.", 404);
    story.content = applyStoryPatch(story, patch, state, now);
    story.updated_at = now;
    writeMockState(state);
    return (await this.listPages()).find((page) => page.id === id)!;
  }

  async createRedirect(input: { source: string; target: string; note?: string }): Promise<PageRecord> {
    const state = this.state();
    const now = new Date().toISOString();
    const source = input.source.trim();
    const target = input.target.trim();
    const pages = pagesFrom(state, mockLinkStatus);
    const match = pages.find((page) => page.kind === "story" && page.realPath && normalizeLocation(page.realPath, page.domain) === normalizeLocation(source, page.domain));
    if (match) {
      return this.updatePage(match.id, { redirectUrl: target, note: input.note ?? match.note, realPath: match.realPath });
    }
    const manual: ManualRedirect = {
      id: crypto.randomUUID(),
      name: "Manueller Redirect",
      domain: fieldMapping.defaultDomain,
      source,
      target,
      note: input.note ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const draftPages = pagesFrom({ ...state, manuals: [...state.manuals, manual] }, mockLinkStatus);
    const created = draftPages.find((page) => page.id === `manual:${manual.id}`);
    if (!created) throw new AppError("Redirect konnte nicht angelegt werden.");
    const error = explainPageChange(created.id, pageToSettings(created), rowsOf(draftPages));
    if (error) throw new AppError(error);
    state.manuals.unshift(manual);
    writeMockState(state);
    return (await this.listPages()).find((page) => page.id === created.id)!;
  }

  async checkLinks(): Promise<PageRecord[]> {
    return this.listPages();
  }

  async listScripts(): Promise<ScriptRecord[]> {
    return ensureTermly(this.state().scripts);
  }

  async saveScripts(scripts: ScriptRecord[]): Promise<ScriptRecord[]> {
    const state = this.state();
    state.scripts = replaceScripts(scripts);
    writeMockState(state);
    return state.scripts;
  }

  async reset(): Promise<void> {
    writeMockState(seedState());
  }
}

export class LiveRepository implements AppRepository {
  mode: "pat" | "oauth";
  constructor(private readonly client: StoryblokClient, mode: "pat" | "oauth") {
    this.mode = mode;
  }

  async listPages(): Promise<PageRecord[]> {
    const [stories, scripts, manuals] = await Promise.all([this.loadStories(), this.listScripts(), this.loadManuals()]);
    return pagesFrom({ stories, scripts, manuals }, (_id, href) => cachedStatus(href));
  }

  async updatePage(id: string, patch: PagePatch): Promise<PageRecord> {
    if (id.startsWith("manual:")) return this.updateManual(id.slice("manual:".length), patch);
    const story = await this.client.request<{ story: StoryRecord }>(`/spaces/${this.client.spaceId}/stories/${id}`);
    const now = new Date().toISOString();
    const stateStories = await this.loadStories();
    const scripts = await this.listScripts();
    const manuals = await this.loadManuals();
    const pages = pagesFrom({ stories: stateStories, scripts, manuals }, (_id, href) => cachedStatus(href));
    story.story.content = applyStoryPatch(story.story, patch, { stories: stateStories, scripts, manuals }, now, pages);
    await this.client.request(`/spaces/${this.client.spaceId}/stories/${id}`, {
      method: "PUT",
      body: JSON.stringify({ publish: autoPublish(), story: { name: story.story.name, slug: story.story.slug, id: story.story.id, content: story.story.content } }),
    });
    const updated = normalizeStory(story.story);
    const nextStories = stateStories.map((item) => (String(item.id) === id ? updated : item));
    if (!nextStories.some((item) => String(item.id) === id)) nextStories.push(updated);
    return pagesFrom({ stories: nextStories, scripts, manuals }, (_id, href) => cachedStatus(href)).find((page) => page.id === id)!;
  }

  async createRedirect(input: { source: string; target: string; note?: string }): Promise<PageRecord> {
    const pages = await this.listPages();
    const source = input.source.trim();
    const match = pages.find((page) => page.kind === "story" && page.realPath && normalizeLocation(page.realPath, page.domain) === normalizeLocation(source, page.domain));
    if (match) return this.updatePage(match.id, { redirectUrl: input.target.trim(), note: input.note ?? match.note });
    const manuals = await this.loadManuals();
    const now = new Date().toISOString();
    const manual: ManualRedirect = {
      id: crypto.randomUUID(),
      name: "Manueller Redirect",
      domain: fieldMapping.defaultDomain,
      source,
      target: input.target.trim(),
      note: input.note ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const next = [manual, ...manuals];
    const draft = pagesFrom({ stories: await this.loadStories(), scripts: await this.listScripts(), manuals: next }, () => null);
    const created = draft.find((page) => page.id === `manual:${manual.id}`);
    const error = created ? explainPageChange(created.id, pageToSettings(created), rowsOf(draft)) : "Redirect konnte nicht angelegt werden.";
    if (error) throw new AppError(error);
    await this.saveManuals(next);
    return (await this.listPages()).find((page) => page.id === `manual:${manual.id}`)!;
  }

  async checkLinks(): Promise<PageRecord[]> {
    const pages = await this.listPages();
    const urls = [...new Set(pages.flatMap((page) => page.outgoing.map((link) => link.href)))];
    const deadline = Date.now() + CHECK_LINKS_BUDGET_MS;
    await mapPool(
      urls,
      CHECK_LINKS_CONCURRENCY,
      async (url) => {
        const entry = liveStatusCache.get(url);
        if (entry && Date.now() - entry.at < STATUS_TTL_MS) return;
        if (Date.now() > deadline) return;
        liveStatusCache.set(url, { status: await fetchHttpStatus(url), at: Date.now() });
      },
      () => Date.now() > deadline,
    );
    return this.listPages();
  }

  async listScripts(): Promise<ScriptRecord[]> {
    const story = await this.configStory(fieldMapping.scriptCatalog.fullSlug);
    if (!story) return ensureTermly(initialScripts);
    return ensureTermly(parseJsonField<ScriptRecord[]>(story.content[fieldMapping.scriptCatalog.jsonField]) ?? initialScripts);
  }

  async saveScripts(scripts: ScriptRecord[]): Promise<ScriptRecord[]> {
    const next = replaceScripts(scripts);
    await this.writeConfig(
      fieldMapping.scriptCatalog.component,
      "Scriptverwaltung",
      fieldMapping.scriptCatalog.storySlug,
      fieldMapping.scriptCatalog.fullSlug,
      fieldMapping.scriptCatalog.jsonField,
      "Zentrale Scriptkonfiguration",
      { schemaVersion: 1, scripts: next },
    );
    return next;
  }

  async reset(): Promise<void> {
    throw new AppError("Zurücksetzen ist nur im Mock-Modus möglich.", 403);
  }

  private async updateManual(manualId: string, patch: PagePatch): Promise<PageRecord> {
    const manuals = await this.loadManuals();
    const manual = manuals.find((item) => item.id === manualId);
    if (!manual) throw new AppError("Redirect nicht gefunden.", 404);
    const pages = await this.listPages();
    const current = pages.find((page) => page.id === `manual:${manualId}`);
    if (!current) throw new AppError("Redirect nicht gefunden.", 404);
    const now = new Date().toISOString();
    const next = applyPatch(pageToSettings(current), patch, now);
    const error = explainPageChange(current.id, next, rowsOf(pages));
    if (error) throw new AppError(error);
    manual.source = next.realPath;
    manual.target = next.redirectUrl;
    manual.note = next.note;
    manual.domain = next.domain;
    manual.updatedAt = now;
    await this.saveManuals(manuals);
    const stories = await this.loadStories();
    const scripts = await this.listScripts();
    return pagesFrom({ stories, scripts, manuals }, (_id, href) => cachedStatus(href)).find((page) => page.id === current.id)!;
  }

  private async loadManuals(): Promise<ManualRedirect[]> {
    const story = await this.configStory(fieldMapping.manualRedirects.fullSlug);
    if (!story) return [];
    return parseJsonField<ManualRedirect[]>(story.content[fieldMapping.manualRedirects.jsonField]) ?? [];
  }

  private async saveManuals(manuals: ManualRedirect[]): Promise<void> {
    await this.writeConfig(
      fieldMapping.manualRedirects.component,
      "SEO-Redirects",
      fieldMapping.manualRedirects.storySlug,
      fieldMapping.manualRedirects.fullSlug,
      fieldMapping.manualRedirects.jsonField,
      "Manuelle 301-Weiterleitungen ohne eigene Story",
      manuals,
    );
  }

  private async loadStories(): Promise<StoryRecord[]> {
    const allowed = new Set(schemaGap.rootsWithSeitenkonfiguration);
    const stories: StoryRecord[] = [];
    for (let page = 1; page <= 40; page += 1) {
      const data = await this.client.request<{ stories: StoryRecord[] }>(`/spaces/${this.client.spaceId}/stories?page=${page}&per_page=25`);
      const batch = data.stories ?? [];
      for (const item of batch) {
        if (item.full_slug?.startsWith("config/")) continue;
        const component = item.content?.component;
        if (typeof component === "string" && allowed.has(component as never)) stories.push(normalizeStory(item));
      }
      if (batch.length < 25) break;
    }
    return stories;
  }

  private async configStory(fullSlug: string): Promise<StoryRecord | null> {
    const data = await this.client.request<{ stories: StoryRecord[] }>(`/spaces/${this.client.spaceId}/stories?starts_with=config/&per_page=25`);
    const found = (data.stories ?? []).find((story) => story.full_slug === fullSlug);
    if (!found) return null;
    const full = await this.client.request<{ story: StoryRecord }>(`/spaces/${this.client.spaceId}/stories/${found.id}`);
    return normalizeStory(full.story);
  }

  private async writeConfig(component: string, name: string, slug: string, fullSlug: string, field: string, display: string, value: unknown): Promise<void> {
    await this.ensureComponent(component, display, field);
    const folderId = await this.ensureFolder();
    const existing = await this.configStory(fullSlug);
    const content = { component, [field]: JSON.stringify(value) };
    const publish = autoPublish();
    if (!existing) {
      await this.client.request(`/spaces/${this.client.spaceId}/stories`, {
        method: "POST",
        body: JSON.stringify({ publish, story: { name, slug, parent_id: folderId, content } }),
      });
      return;
    }
    await this.client.request(`/spaces/${this.client.spaceId}/stories/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ publish, story: { name, slug: existing.slug, id: existing.id, parent_id: folderId, content } }),
    });
  }

  private async ensureFolder(): Promise<number> {
    const data = await this.client.request<{ stories: Array<StoryRecord & { is_folder?: boolean }> }>(`/spaces/${this.client.spaceId}/stories?with_slug=config&per_page=10`);
    const folder = (data.stories ?? []).find((story) => story.slug === "config" || story.full_slug === "config");
    if (folder) return folder.id;
    const created = await this.client.request<{ story: { id: number } }>(`/spaces/${this.client.spaceId}/stories`, {
      method: "POST",
      body: JSON.stringify({ story: { name: "Konfiguration", slug: "config", is_folder: true } }),
    });
    return created.story.id;
  }

  private async ensureComponent(name: string, display: string, field: string): Promise<void> {
    for (let page = 1; page <= 5; page += 1) {
      const data = await this.client.request<{ components: Array<{ name: string }> }>(`/spaces/${this.client.spaceId}/components?page=${page}&per_page=100`);
      const batch = data.components ?? [];
      if (batch.some((component) => component.name === name)) return;
      if (batch.length < 100) break;
    }
    await this.client.request(`/spaces/${this.client.spaceId}/components`, {
      method: "POST",
      body: JSON.stringify({
        component: {
          name,
          display_name: display,
          is_root: true,
          is_nestable: false,
          schema: {
            [field]: {
              type: "textarea",
              pos: 0,
              display_name: "JSON",
              description: "Wird von der Halteverbot123-Space-App geschrieben. Snippets nicht ausführen.",
            },
          },
        },
      }),
    });
  }
}

function autoPublish(): boolean {
  return process.env.STORYBLOK_AUTO_PUBLISH === "true";
}

function normalizeStory(story: StoryRecord): StoryRecord {
  return {
    ...story,
    content: story.content ?? {},
    published: Boolean(story.published ?? story.published_at),
    published_at: story.published_at ?? null,
    full_slug: story.full_slug ?? story.slug,
  };
}

function parseJsonField<T>(value: unknown): T | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("[storyblok] JSON-Feld ungültig", error instanceof Error ? error.message : error);
    return null;
  }
}

function pageToSettings(page: PageRecord): PageSettings {
  return {
    domain: page.domain,
    realPath: page.realPath,
    redirectUrl: page.redirectUrl,
    redirectDate: page.redirectDate,
    note: page.note,
    canonical: page.canonical,
    index: page.index,
    follow: page.follow,
    sitemap: page.sitemap,
    tracking: Object.fromEntries(page.tracking.map((toggle) => [toggle.id, toggle.enabled])),
    seoTitle: page.seoTitle,
    hasSeoTitleField: page.hasSeoTitleField,
  };
}

function applyStoryPatch(story: StoryRecord, patch: PagePatch, state: Pick<MockState, "stories" | "scripts" | "manuals">, now: string, knownPages?: PageRecord[]): Record<string, unknown> {
  const scripts = ensureTermly(state.scripts);
  const component = typeof story.content.component === "string" ? story.content.component : null;
  const current = readPageSettings(story.content, component, scripts);
  const next = applyPatch(current, patch, now);
  const pages = knownPages ?? pagesFrom(state, () => null);
  const error = explainPageChange(String(story.id), next, rowsOf(pages));
  if (error) throw new AppError(error);
  return writePageSettings(story.content, next, component);
}

export function resolveMode(): "mock" | "pat" | "oauth" {
  const explicit = process.env.APP_MODE;
  if (explicit === "mock" || explicit === "pat" || explicit === "oauth") return explicit;
  if (process.env.STORYBLOK_PAT) return "pat";
  return "mock";
}

export { StoryblokError };
