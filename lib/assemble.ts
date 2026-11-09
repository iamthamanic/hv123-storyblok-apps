/**
 * Baut die Seiten-Check-Zeilen aus Stories, manuellen Redirects und dem Scriptkatalog.
 * Linkstatus kommt von außen (Mock-Fixture oder HTTP-Prüfung).
 */

import fieldMapping from "@/config/field-mapping.json";
import { brokenErrorType, brokenMessage, isBrokenStatus } from "@/lib/http-status";
import { extractLinks, incomingFrom, toLinkView, type LabelBook, type PageRef } from "@/lib/links";
import { editorUrl, readPageSettings } from "@/lib/mapping";
import type { LinkView, ManualRedirect, PageRecord, ScriptRecord, StoryRecord, TrackingToggle } from "@/lib/types";

export function assemblePages(input: {
  stories: StoryRecord[];
  manuals: ManualRedirect[];
  scripts: ScriptRecord[];
  labels: LabelBook;
  statusFor: (sourceId: string, href: string) => number | null;
}): PageRecord[] {
  const skip = fieldMapping.linkExtraction.skipContentKeys;
  const suffix = fieldMapping.internalHostSuffix;
  const storyPages = input.stories.map((story) => storyPage(story, input.scripts));
  const manualPages = input.manuals.map((manual) => manualPage(manual));
  const shells = [...storyPages, ...manualPages];
  const refs: PageRef[] = shells.map((page) => ({
    id: page.id,
    name: page.name,
    uuid: page.uuid,
    fullSlug: page.fullSlug,
    realPath: page.realPath,
    domain: page.domain,
  }));

  const outgoingById = new Map<string, LinkView[]>();
  for (const story of input.stories) {
    const page = storyPages.find((item) => item.storyId === story.id);
    if (!page) continue;
    const source = refs.find((ref) => ref.id === page.id)!;
    const rawLinks = extractLinks(story.content, input.labels, skip);
    const outgoing = rawLinks.map((raw) => {
      const view = toLinkView(raw, source, refs, null, suffix);
      return decorate(view, input.statusFor(page.id, view.href));
    });
    outgoingById.set(page.id, outgoing);
  }

  const allOutgoing = [...outgoingById.values()].flat();
  return shells.map((page) => {
    const outgoing = outgoingById.get(page.id) ?? [];
    const incoming = incomingFrom(allOutgoing, page.id).map((link) => ({
      ...link,
      sourceName: shells.find((item) => item.id === link.sourceId)?.name || link.sourceName,
    }));
    const broken = outgoing.filter((link) => link.broken);
    return { ...page, outgoing, incoming, broken };
  });
}

function decorate(link: LinkView, status: number | null): LinkView {
  const errorType = brokenErrorType(status);
  return {
    ...link,
    status,
    broken: isBrokenStatus(status),
    errorType,
    message: errorType ? brokenMessage(errorType) : status == null ? "Noch nicht geprüft" : `HTTP ${status}`,
  };
}

function trackingToggles(tracking: Record<string, boolean>, scripts: ScriptRecord[]): TrackingToggle[] {
  return scripts
    .filter((script) => script.id !== "termly")
    .map((script) => ({
      id: script.id,
      name: script.name,
      category: script.category,
      enabled: tracking[script.id] !== false,
    }));
}

function storyPage(story: StoryRecord, scripts: ScriptRecord[]): PageRecord {
  const component = typeof story.content.component === "string" ? story.content.component : null;
  const settings = readPageSettings(story.content, component, scripts);
  return {
    id: String(story.id),
    storyId: story.id,
    uuid: story.uuid,
    name: story.name,
    slug: story.slug,
    fullSlug: story.full_slug,
    component,
    editorUrl: editorUrl(story.id),
    domain: settings.domain,
    realPath: settings.realPath,
    redirectEnabled: Boolean(settings.redirectUrl),
    redirectUrl: settings.redirectUrl,
    redirectDate: settings.redirectDate,
    note: settings.note,
    canonical: settings.canonical,
    index: settings.index,
    follow: settings.follow,
    sitemap: settings.sitemap,
    tracking: trackingToggles(settings.tracking, scripts),
    seoTitle: settings.seoTitle,
    hasSeoTitleField: settings.hasSeoTitleField,
    kind: "story",
    updatedAt: story.updated_at,
    published: story.published,
    outgoing: [],
    incoming: [],
    broken: [],
  };
}

function manualPage(manual: ManualRedirect): PageRecord {
  return {
    id: `manual:${manual.id}`,
    storyId: null,
    uuid: null,
    name: manual.name || "Manueller Redirect",
    slug: "",
    fullSlug: "",
    component: null,
    editorUrl: null,
    domain: manual.domain || fieldMapping.defaultDomain,
    realPath: manual.source,
    redirectEnabled: Boolean(manual.target),
    redirectUrl: manual.target,
    redirectDate: manual.createdAt,
    note: manual.note,
    canonical: "",
    index: false,
    follow: false,
    sitemap: false,
    tracking: [],
    seoTitle: "",
    hasSeoTitleField: false,
    kind: "redirect",
    updatedAt: manual.updatedAt,
    published: false,
    outgoing: [],
    incoming: [],
    broken: [],
  };
}

export function pageRefsOf(pages: PageRecord[]): { id: string; realPath: string; redirectUrl: string }[] {
  return pages.map((page) => ({ id: page.id, realPath: page.realPath, redirectUrl: page.redirectUrl }));
}
