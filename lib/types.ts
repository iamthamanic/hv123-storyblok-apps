/**
 * Gemeinsame Typen der Space Apps Seiten-Check und Scriptverwaltung.
 * Reine Datenformen, ohne Storyblok-Aufrufe.
 */

export const COOKIE_CATEGORIES = ["Notwendig", "Analytik", "Marketing", "Funktional"] as const;
export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];

export const SCRIPT_TYPES = ["consent", "analytics", "marketing", "experiment"] as const;
export type ScriptType = (typeof SCRIPT_TYPES)[number];

export type ScriptRecord = {
  id: string;
  name: string;
  details: string;
  websiteUrl: string;
  sourceText: string;
  implementedAt: string;
  reason: string;
  note: string;
  snippet: string;
  category: CookieCategory;
  type: ScriptType;
  active: boolean;
  required: boolean;
  order: number;
};

export type StoryRecord = {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
  published: boolean;
};

export type ManualRedirect = {
  id: string;
  name: string;
  domain: string;
  source: string;
  target: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type RelFlag = "follow" | "nofollow";

export type RawLink = {
  rawHref: string;
  anchor: string;
  rel: RelFlag;
  storyUuid?: string;
  cachedUrl?: string;
  section: string;
  component: string;
  instanceTitle: string;
  field: string;
  fieldKey: string;
};

export type LinkView = {
  direction: "outgoing" | "incoming";
  kind: "internal" | "external";
  anchor: string;
  href: string;
  rel: RelFlag;
  status: number | null;
  section: string;
  component: string;
  instanceTitle: string;
  field: string;
  sourceId: string;
  sourceName: string;
  targetId: string | null;
  broken: boolean;
  errorType: "404" | "410" | null;
  message: string;
};

export type TrackingToggle = {
  id: string;
  name: string;
  enabled: boolean;
  category: CookieCategory;
};

export type PageRecord = {
  id: string;
  storyId: number | null;
  uuid: string | null;
  name: string;
  slug: string;
  fullSlug: string;
  component: string | null;
  editorUrl: string | null;
  domain: string;
  realPath: string;
  redirectEnabled: boolean;
  redirectUrl: string;
  redirectDate: string;
  note: string;
  canonical: string;
  index: boolean;
  follow: boolean;
  sitemap: boolean;
  tracking: TrackingToggle[];
  seoTitle: string;
  hasSeoTitleField: boolean;
  kind: "story" | "redirect";
  updatedAt: string;
  published: boolean;
  outgoing: LinkView[];
  incoming: LinkView[];
  broken: LinkView[];
};

export type PagePatch = {
  domain?: string;
  realPath?: string;
  redirectUrl?: string;
  note?: string;
  canonical?: string;
  index?: boolean;
  follow?: boolean;
  sitemap?: boolean;
  tracking?: Record<string, boolean>;
  seoTitle?: string;
};

export type RobotsState = {
  index: boolean;
  follow: boolean;
};

export type KeySpec = {
  key: string;
  aliases?: string[];
};
