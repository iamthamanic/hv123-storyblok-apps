/**
 * URL-Helfer und Link-Filter für Seiten-Check.
 * Ort: /components/seiten-check/link-utils.ts
 */

import type { LinkView, PageRecord } from "@/lib/types";
import type { LinkFocus } from "@/components/seiten-check/types";

export function pageLiveUrl(page: Pick<PageRecord, "domain" | "realPath">): string | null {
  const path = page.realPath.trim();
  if (!path || !page.domain) return null;
  return `https://${page.domain}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolveHref(value: string, domain = ""): string | null {
  const href = value.trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/") && domain) return `https://${domain}${href}`;
  return null;
}

export function linksForFocus(page: PageRecord, focus: LinkFocus): { outgoing: LinkView[]; incoming: LinkView[] } {
  if (focus === "incoming") return { outgoing: [], incoming: page.incoming };
  if (focus === "internal") return { outgoing: page.outgoing.filter((link) => link.kind === "internal"), incoming: [] };
  if (focus === "external") return { outgoing: page.outgoing.filter((link) => link.kind === "external"), incoming: [] };
  if (focus === "outgoing") return { outgoing: page.outgoing, incoming: [] };
  return { outgoing: page.outgoing, incoming: page.incoming };
}
