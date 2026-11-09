/**
 * Gemeinsame Typen und Spaltendefinitionen für Seiten-Check.
 * Ort: /components/seiten-check/types.ts
 */

import type { TableColumn } from "@/components/table/TableToolsMenu";
import type { PageRecord } from "@/lib/types";

export type LinkFocus = "all" | "outgoing" | "internal" | "incoming" | "external";
export type View = "all" | "links";
export type Filter = "all" | "redirect" | "broken" | "noindex" | "pathless";
export type Edit = { id: string; field: "realPath" | "redirectUrl" | "canonical" | "note" } | null;
export type DrawerTab = "path" | "seo" | "broken" | "links";

export const WIDTHS: Record<string, number> = {
  name: 220, domain: 200, realPath: 240, index: 110, follow: 110, canonical: 200,
  redirect: 120, redirectUrl: 220, sitemap: 100, redirectDate: 130, note: 180, broken: 120, updated: 120,
};

export const LINK_WIDTHS: Record<string, number> = {
  name: 220, realPath: 240, outgoing: 110, internal: 130, incoming: 140, external: 140, backlinks: 140, broken: 120,
};

export const PAGE_COLUMNS: TableColumn<PageRecord>[] = [
  { id: "name", label: "Seitenname", value: (page) => page.name },
  { id: "domain", label: "Domain", value: (page) => page.domain },
  { id: "realPath", label: "Real Path", value: (page) => page.realPath },
  { id: "index", label: "Index", value: (page) => (page.index ? "Index" : "Noindex") },
  { id: "follow", label: "Follow", value: (page) => (page.follow ? "Follow" : "Nofollow") },
  { id: "canonical", label: "Canonical", value: (page) => page.canonical || page.realPath },
  { id: "redirect", label: "Redirect 301", value: (page) => (page.redirectUrl ? "ja" : "nein") },
  { id: "redirectUrl", label: "Redirect-URL", value: (page) => page.redirectUrl },
  { id: "redirectDate", label: "Redirect-Datum", value: (page) => page.redirectDate },
  { id: "note", label: "Notiz", value: (page) => page.note },
  { id: "sitemap", label: "Sitemap", value: (page) => (page.sitemap ? "ja" : "nein") },
  { id: "broken", label: "Broken Links", value: (page) => page.broken.length },
  { id: "updated", label: "Geändert", value: (page) => page.updatedAt },
];

export const LINK_COLUMNS: TableColumn<PageRecord>[] = [
  { id: "name", label: "Seitenname", value: (page) => page.name },
  { id: "realPath", label: "Real Path", value: (page) => page.realPath },
  { id: "outgoing", label: "Ausgehend", value: (page) => page.outgoing.length },
  { id: "internal", label: "Intern ausgehend", value: (page) => page.outgoing.filter((link) => link.kind === "internal").length },
  { id: "incoming", label: "Intern eingehend", value: (page) => page.incoming.length },
  { id: "external", label: "Extern ausgehend", value: (page) => page.outgoing.filter((link) => link.kind === "external").length },
  { id: "backlinks", label: "Extern eingehend", value: () => "Nicht erfasst" },
  { id: "broken", label: "Linkfehler", value: (page) => page.broken.length },
];
