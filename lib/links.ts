/**
 * Extrahiert ausgehende Links aus Storyblok-Content (Richtext, Multilink, Textfelder)
 * und ordnet sie internen Seiten oder externen URLs zu.
 */

import { brokenErrorType, brokenMessage, isBrokenStatus } from "@/lib/http-status";
import type { LinkView, RawLink, RelFlag } from "@/lib/types";

export type LabelBook = Record<string, { displayName: string; fields: Record<string, { displayName?: string }> }>;

type RichNode = {
  type?: string;
  text?: string;
  content?: RichNode[];
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
};

const LINK_FIELD = /(link|url|href)$/i;

export function plainText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const node = value as RichNode;
  if (typeof node.text === "string" && node.type === "text") {
    const nested = (node.content ?? []).map((child) => plainText(child)).join("");
    return `${node.text}${nested}`.trim();
  }
  if (Array.isArray(node.content)) return node.content.map((child) => plainText(child)).join(" ").replace(/\s+/g, " ").trim();
  return "";
}

function relFrom(value: unknown): RelFlag {
  const text = typeof value === "string" ? value : "";
  if (/\bnofollow\b/i.test(text)) return "nofollow";
  return "follow";
}

function isRichtext(value: unknown): value is RichNode {
  if (!value || typeof value !== "object") return false;
  const node = value as RichNode;
  return node.type === "doc" && Array.isArray(node.content);
}

function isMultilink(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.fieldtype === "multilink" || record.linktype === "story" || record.linktype === "url";
}

export function isInternalHost(hostname: string, suffix: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const base = suffix.toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}

export function isInternalHref(href: string, suffix: string): boolean {
  if (!href) return false;
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  try {
    return isInternalHost(new URL(href).hostname, suffix);
  } catch {
    return false;
  }
}

export function normalizeHrefPath(href: string, domain: string): string {
  try {
    const url = new URL(href, `https://${domain}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${path}${url.search}`;
  } catch {
    return href.replace(/\/+$/, "") || "/";
  }
}

type Frame = { component: string; display: string; instance: string };

function displayName(labels: LabelBook, component: string): string {
  return labels[component]?.displayName || component;
}

function fieldLabel(labels: LabelBook, component: string, field: string): string {
  return labels[component]?.fields?.[field]?.displayName || field;
}

function instanceTitle(record: Record<string, unknown>): string {
  return plainText(record.title) || plainText(record.label) || plainText(record.name) || plainText(record.headline) || "";
}

function siblingAnchor(parent: Record<string, unknown>, field: string): string {
  const prefix = field.replace(/_(link|url|href)$/i, "");
  const keys = [`${prefix}_text`, `${prefix}_label`, "label", "button_text", "cta_text", "text", "title", "name"];
  for (const key of keys) {
    const text = plainText(parent[key]);
    if (text) return text;
  }
  return "";
}

function siblingRel(parent: Record<string, unknown>, field: string): RelFlag {
  const direct = parent[`${field}_rel`] ?? parent.rel;
  return relFrom(direct);
}

function pushLink(acc: RawLink[], link: RawLink, seen: Set<string>): void {
  const key = `${link.section}|${link.component}|${link.fieldKey}|${link.rawHref}|${link.anchor}`;
  if (seen.has(key)) return;
  seen.add(key);
  acc.push(link);
}

function walkRichtext(node: RichNode, acc: RawLink[], seen: Set<string>, place: Omit<RawLink, "rawHref" | "anchor" | "rel" | "storyUuid" | "cachedUrl">, relHint: RelFlag): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "text" && Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      if (mark?.type !== "link") continue;
      const href = String(mark.attrs?.href ?? mark.attrs?.url ?? "").trim();
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
      const rel = relFrom(mark.attrs?.rel ?? (mark.attrs?.custom as Record<string, unknown> | undefined)?.rel) ;
      pushLink(acc, { ...place, rawHref: href, anchor: node.text?.trim() || href, rel: rel === "follow" ? relHint === "nofollow" ? "nofollow" : "follow" : rel }, seen);
    }
  }
  if (node.type === "link") {
    const href = String(node.attrs?.href ?? node.attrs?.url ?? "").trim();
    const anchor = plainText(node) || href;
    if (href && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      pushLink(acc, { ...place, rawHref: href, anchor, rel: relFrom(node.attrs?.rel) }, seen);
    }
  }
  for (const child of node.content ?? []) walkRichtext(child, acc, seen, place, relHint);
}

function location(stack: Frame[], field: string, labels: LabelBook, component: string): Pick<RawLink, "section" | "component" | "instanceTitle" | "field" | "fieldKey"> {
  const leaf = stack[stack.length - 1];
  const parent = stack.length > 1 ? stack[stack.length - 2] : undefined;
  return {
    section: parent ? parent.instance || parent.display : leaf?.display || "",
    component: leaf?.display || displayName(labels, component),
    instanceTitle: leaf?.instance || "",
    field: fieldLabel(labels, leaf ? component : component, field),
    fieldKey: field,
  };
}

export function extractLinks(content: unknown, labels: LabelBook, skipKeys: string[] = ["seitenkonfiguration"]): RawLink[] {
  const acc: RawLink[] = [];
  const seen = new Set<string>();
  const skip = new Set(skipKeys);

  function walk(value: unknown, stack: Frame[], field: string, parent: Record<string, unknown> | null): void {
    if (isMultilink(value)) {
      const linktype = String(value.linktype ?? "");
      if (linktype === "asset" || linktype === "email") return;
      const rawHref = String(value.url || value.cached_url || "").trim();
      const cached = String(value.cached_url || "").trim();
      const uuid = typeof value.id === "string" ? value.id : undefined;
      if (!rawHref && !uuid && !cached) return;
      const component = stack[stack.length - 1]?.component || "";
      const place = location(stack, field, labels, component);
      // location() used the technical component name from the frame's display path.
      // Rebuild field label with the technical name stored alongside.
      place.field = fieldLabel(labels, technicalName(stack), field);
      pushLink(
        acc,
        {
          ...place,
          rawHref: rawHref || cached,
          anchor: (parent && siblingAnchor(parent, field)) || cached || rawHref,
          rel: parent ? siblingRel(parent, field) : "follow",
          storyUuid: uuid,
          cachedUrl: cached,
        },
        seen,
      );
      return;
    }
    if (isRichtext(value)) {
      const component = technicalName(stack);
      const place = location(stack, field, labels, component);
      place.field = fieldLabel(labels, component, field);
      walkRichtext(value, acc, seen, place, "follow");
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, stack, field, parent);
      return;
    }
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && LINK_FIELD.test(field)) {
        const href = value.trim();
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;
        if (!href.startsWith("/") && !/^https?:\/\//i.test(href)) return;
        const component = technicalName(stack);
        const place = location(stack, field, labels, component);
        place.field = fieldLabel(labels, component, field);
        pushLink(
          acc,
          {
            ...place,
            rawHref: href,
            anchor: (parent && siblingAnchor(parent, field)) || href,
            rel: parent ? siblingRel(parent, field) : "follow",
          },
          seen,
        );
      }
      return;
    }
    const record = value as Record<string, unknown>;
    const nextStack = stack;
    let frameStack = stack;
    if (typeof record.component === "string") {
      frameStack = [
        ...stack,
        {
          component: record.component,
          display: displayName(labels, record.component),
          instance: instanceTitle(record),
        },
      ];
    }
    for (const [key, child] of Object.entries(record)) {
      if (skip.has(key) || key === "component" || key === "_uid" || key === "_editable" || key.endsWith("_ai_marker")) continue;
      walk(child, frameStack, key, record);
    }
    void nextStack;
  }

  walk(content, [], "content", null);
  return acc;
}

function technicalName(stack: Frame[]): string {
  return stack[stack.length - 1]?.component || "";
}

export type PageRef = {
  id: string;
  name: string;
  uuid: string | null;
  fullSlug: string;
  realPath: string;
  domain: string;
};

export function publicUrl(page: Pick<PageRef, "domain" | "realPath" | "fullSlug">): string {
  if (page.realPath) {
    if (/^https?:\/\//i.test(page.realPath)) return page.realPath;
    const path = page.realPath.startsWith("/") ? page.realPath : `/${page.realPath}`;
    return `https://${page.domain}${path}`;
  }
  const slug = page.fullSlug.replace(/^\/+|\/+$/g, "");
  return slug ? `https://${page.domain}/${slug}` : `https://${page.domain}/`;
}

function matchPage(raw: RawLink, pages: PageRef[], domain: string): PageRef | undefined {
  if (raw.storyUuid) {
    const byUuid = pages.find((page) => page.uuid === raw.storyUuid);
    if (byUuid) return byUuid;
  }
  const candidates = [raw.rawHref, raw.cachedUrl || ""].filter(Boolean);
  for (const candidate of candidates) {
    const key = normalizeHrefPath(candidate, domain);
    const found = pages.find((page) => {
      if (page.realPath && normalizeHrefPath(page.realPath, page.domain) === key) return true;
      const slug = `/${page.fullSlug.replace(/^\/+|\/+$/g, "")}`;
      return normalizeHrefPath(slug, page.domain) === key;
    });
    if (found) return found;
  }
  return undefined;
}

export function toLinkView(raw: RawLink, source: PageRef, pages: PageRef[], status: number | null, suffix: string): LinkView {
  const target = matchPage(raw, pages, source.domain);
  const href = target ? publicUrl(target) : absoluteHref(raw.rawHref || raw.cachedUrl || "", source.domain);
  const kind = target || isInternalHref(href, suffix) ? "internal" : "external";
  const errorType = brokenErrorType(status);
  return {
    direction: "outgoing",
    kind,
    anchor: raw.anchor,
    href,
    rel: raw.rel,
    status,
    section: raw.section,
    component: raw.component,
    instanceTitle: raw.instanceTitle,
    field: raw.field,
    sourceId: source.id,
    sourceName: source.name,
    targetId: target?.id ?? null,
    broken: isBrokenStatus(status),
    errorType,
    message: errorType ? brokenMessage(errorType) : status == null ? "Noch nicht geprüft" : `HTTP ${status}`,
  };
}

function absoluteHref(href: string, domain: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return `https://${domain}${href}`;
  return `https://${domain}/${href.replace(/^\/+/, "")}`;
}

export function incomingFrom(allOutgoing: LinkView[], pageId: string): LinkView[] {
  return allOutgoing
    .filter((link) => link.targetId === pageId && link.kind === "internal")
    .map((link) => ({ ...link, direction: "incoming" as const }));
}
