/**
 * Beispieldaten passend zum Klickdummy.
 * Stories nutzen echte Komponentennamen aus dem Space (city_page, page, service_page, anlass_page).
 * SEO- und Tracking-Werte liegen im Feld seitenkonfiguration.
 */

import type { ManualRedirect, ScriptRecord, StoryRecord } from "@/lib/types";
import { normalizeOrder } from "@/lib/order";

const DOMAIN = "website-dev.halteverbot123.de";

function textDoc(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
}

function linkDoc(text: string, href: string, rel: "follow" | "nofollow" = "follow") {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text, marks: [{ type: "link", attrs: { href, rel, linktype: "url" } }] }],
      },
    ],
  };
}

type Track = { browo?: boolean; gtm?: boolean; meta?: boolean; zoho?: boolean };

function settings(input: {
  path?: string;
  redirect?: string;
  redirectDate?: string;
  note?: string;
  canonical?: string;
  index?: boolean;
  follow?: boolean;
  sitemap?: boolean;
  tracking?: Track;
}) {
  const index = input.index !== false;
  const follow = input.follow !== false;
  const tracking = input.tracking ?? {};
  return {
    real_path: input.path ?? "",
    domain: DOMAIN,
    redirect_301: Boolean(input.redirect),
    redirect_url: input.redirect ?? "",
    redirect_date: input.redirect ? input.redirectDate ?? "" : "",
    note: input.note ?? "",
    canonical: input.canonical ?? "",
    index,
    noindex: !index,
    follow,
    nofollow: !follow,
    sitemap: input.sitemap !== false,
    tracking_browo: tracking.browo !== false,
    tracking_gtm: tracking.gtm !== false,
    tracking_meta_pixel: tracking.meta === true,
    tracking_zoho_pagesense: tracking.zoho === true,
    tracking_extras: {},
  };
}

function story(partial: Omit<StoryRecord, "published" | "published_at"> & { published?: boolean }): StoryRecord {
  return { published: true, published_at: partial.updated_at, ...partial };
}

const serviceLink = (title: string, button: string, href: string, rel?: "nofollow") => ({
  component: "service_item",
  _uid: `svc-${title}-${button}`,
  title: textDoc(title),
  button_text: button,
  button_link: href,
  ...(rel ? { button_link_rel: rel } : {}),
});

export const initialScripts: ScriptRecord[] = normalizeOrder([
  {
    id: "termly",
    name: "Termly",
    details: "Consent-Management-System",
    websiteUrl: "https://termly.io/",
    sourceText: "",
    implementedAt: "2026-11-05",
    reason: "Einwilligungen und Cookie-Kategorien zentral verwalten.",
    note: "Pflichtintegration: Muss vor optionalen Tracking-Scripts initialisiert werden.",
    snippet: "<!-- Termly: technische Integration erfolgt im Website-Layout. Dieses Snippet wird in der App nicht ausgeführt. -->",
    category: "Notwendig",
    type: "consent",
    active: true,
    required: true,
    order: 1,
  },
  {
    id: "browo_tracking",
    name: "Browo Tracking",
    details: "Eigenes Tracking zur Verhaltensanalyse der Websitebesucher",
    websiteUrl: "",
    sourceText: "Eigenentwicklung browo",
    implementedAt: "2026-11-05",
    reason: "Besucherquellen und Interaktionen auf der Website verstehen.",
    note: "Bereits in der Website implementiert; Einwilligung abhängig von der konkreten Messung.",
    snippet: "<!-- Bestehende Browo-Tracking-Integration. Wird hier nur gespeichert. -->",
    category: "Analytik",
    type: "analytics",
    active: true,
    required: false,
    order: 2,
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    details: "Tag-Management-System für Marketing-Integrationen",
    websiteUrl: "https://tagmanager.google.com/",
    sourceText: "",
    implementedAt: "2026-11-05",
    reason: "Zentrale Verwaltung von Marketing-Tags und Conversion-Messung.",
    note: "Derzeit für Google Ads verwendet. Tags im Container separat prüfen.",
    snippet: "<!-- Google Tag Manager Container. Wird hier nur gespeichert. -->",
    category: "Marketing",
    type: "marketing",
    active: true,
    required: false,
    order: 3,
  },
  {
    id: "meta_pixel",
    name: "Meta Pixel",
    details: "Conversion-Tracking und Retargeting für Meta Ads",
    websiteUrl: "https://www.facebook.com/business/tools/meta-pixel",
    sourceText: "",
    implementedAt: "2026-11-05",
    reason: "Kampagnenleistung auswerten und Zielgruppen bilden.",
    note: "Nur nach notwendiger Marketing-Einwilligung laden.",
    snippet: "<!-- Meta Pixel. Wird hier nur gespeichert. -->",
    category: "Marketing",
    type: "marketing",
    active: true,
    required: false,
    order: 4,
  },
  {
    id: "zoho_pagesense",
    name: "Zoho PageSense",
    details: "Heatmaps, Session Recordings und A/B-Tests",
    websiteUrl: "https://pagesense.zoho.eu/",
    sourceText: "",
    implementedAt: "2026-11-05",
    reason: "Nutzungsprobleme erkennen und Conversion-Raten verbessern.",
    note: "Bei SSR- und Hydration-Effekten die Ladephase beachten.",
    snippet: "<!-- Zoho PageSense. Wird hier nur gespeichert. -->",
    category: "Analytik",
    type: "experiment",
    active: true,
    required: false,
    order: 5,
  },
]);

export const initialManuals: ManualRedirect[] = [];

export const initialStories: StoryRecord[] = [
  story({
    id: 101,
    uuid: "story-berlin",
    name: "Halteverbot Berlin",
    slug: "halteverbot-berlin",
    full_slug: "halteverbotszone/stadt/berlin",
    updated_at: "2026-11-07T08:40:00.000Z",
    content: {
      component: "city_page",
      seo_title: "Halteverbot Berlin",
      seo_description: "Halteverbotszone in Berlin beantragen.",
      seitenkonfiguration: settings({ path: "/halteverbotszone/stadt/berlin/" }),
      body: [
        {
          component: "services_section",
          _uid: "berlin-services",
          title: textDoc("Leistungen"),
          services: [
            serviceLink("Baustellenabsicherung", "Baustellenabsicherung", "/verkehrssicherung/baustellenabsicherung/"),
            serviceLink("Container", "Containerstellung beantragen", "/halteverbot-container/"),
          ],
        },
        {
          component: "footer",
          _uid: "berlin-footer",
          links: [
            {
              component: "footer_link",
              _uid: "berlin-events",
              label: "Halteverbot für Events",
              link: { fieldtype: "multilink", linktype: "url", url: "/halteverbot-events/", cached_url: "/halteverbot-events/", id: "" },
            },
          ],
        },
        { component: "seo_text", _uid: "berlin-wiki", title: "Wissenswertes", content: linkDoc("Land Berlin", "https://www.berlin.de/", "nofollow") },
      ],
    },
  }),
  story({
    id: 102,
    uuid: "story-berlin-bestellen",
    name: "Halteverbot Berlin bestellen",
    slug: "halteverbot-berlin-bestellen",
    full_slug: "halteverbot-berlin-bestellen",
    updated_at: "2026-11-06T13:20:00.000Z",
    content: {
      component: "page",
      seo_title: "Halteverbot Berlin bestellen",
      seo_description: "Alte Bestell-URL.",
      seitenkonfiguration: settings({
        path: "/halteverbot-berlin-bestellen.html",
        redirect: "/halteverbotszone/stadt/berlin/",
        redirectDate: "2026-11-06T13:20:00.000Z",
        note: "SEO Cleanup 05.2026",
        canonical: "/halteverbot-berlin-bestellen.html",
      }),
      body: [
        {
          component: "services_section",
          _uid: "bestellen-services",
          title: textDoc("Service Section"),
          services: [
            serviceLink("Fahrbahnmarkierung", "Fahrbahnmarkierung", "https://halteverbot123.de/fahrbahnmarkierungen"),
            serviceLink("Fahrbahnmarkierung", "Baustellenschutz", "https://halteverbot123.de/baustellenschutz"),
          ],
        },
        {
          component: "not_found_cta",
          _uid: "bestellen-hero",
          title: textDoc("Hero"),
          button_text: "Halteverbot Berlin",
          button_link: { fieldtype: "multilink", linktype: "story", id: "story-berlin", url: "", cached_url: "halteverbotszone/stadt/berlin" },
        },
        {
          component: "footer",
          _uid: "bestellen-footer",
          links: [
            {
              component: "footer_link",
              _uid: "bestellen-bau",
              label: "Baustellenabsicherung",
              link: { fieldtype: "multilink", linktype: "url", url: "/verkehrssicherung/baustellenabsicherung/", cached_url: "/verkehrssicherung/baustellenabsicherung/", id: "" },
            },
          ],
        },
      ],
    },
  }),
  story({
    id: 103,
    uuid: "story-berlin-neu",
    name: "Halteverbot Berlin neu",
    slug: "halteverbot-berlin-neu",
    full_slug: "halteverbot-berlin-neu",
    updated_at: "2026-11-04T11:30:00.000Z",
    content: {
      component: "page",
      seo_title: "Halteverbot Berlin neu",
      seo_description: "Kampagnen-Landingpage.",
      seitenkonfiguration: settings({
        path: "/halteverbot-berlin-neu.html",
        note: "Kampagnen-Landingpage",
        canonical: "/halteverbot-berlin-bestellen.html",
        index: false,
        sitemap: false,
        tracking: { meta: true },
      }),
      body: [
        {
          component: "seo_text",
          _uid: "neu-info",
          title: "Information",
          content: linkDoc("Zur Stadtseite", "/halteverbotszone/stadt/berlin/"),
        },
        {
          component: "services_section",
          _uid: "neu-empfehlungen",
          title: textDoc("Empfehlungen"),
          services: [serviceLink("Containerstellung", "Containerstellung", "/halteverbot-container/", "nofollow")],
        },
        { component: "seo_text", _uid: "neu-map", title: "Kartenmodul", content: linkDoc("Kartendaten", "https://www.openstreetmap.org/", "nofollow") },
      ],
    },
  }),
  story({
    id: 104,
    uuid: "story-baustelle",
    name: "Baustellenabsicherung",
    slug: "baustellenabsicherung",
    full_slug: "verkehrssicherung/baustellenabsicherung",
    updated_at: "2026-11-05T16:15:00.000Z",
    content: {
      component: "service_page",
      seo_title: "Baustellenabsicherung",
      seo_description: "Absicherung von Baustellen.",
      seitenkonfiguration: settings({ path: "/verkehrssicherung/baustellenabsicherung/" }),
      body: [
        {
          component: "services_section",
          _uid: "bau-services",
          title: textDoc("Leistungen"),
          services: [
            serviceLink("Halteverbotszone Berlin", "Halteverbotszone Berlin", "/halteverbotszone/stadt/berlin/"),
            serviceLink("Absperrung für Container", "Absperrung für Container", "/halteverbot-container/"),
            serviceLink("Kachel", "Alte Baustellensicherung", "https://halteverbot123.de/baustellensicherung-alt"),
          ],
        },
        { component: "seo_text", _uid: "bau-quellen", title: "Quellen", content: linkDoc("Arbeitsschutzinformationen", "https://www.baua.de/", "nofollow") },
      ],
    },
  }),
  story({
    id: 105,
    uuid: "story-hamburg",
    name: "Halteverbot Hamburg bestellen",
    slug: "halteverbot-hamburg-bestellen",
    full_slug: "halteverbot-hamburg-bestellen",
    updated_at: "2026-10-29T09:25:00.000Z",
    content: {
      component: "page",
      seo_title: "Halteverbot Hamburg bestellen",
      seo_description: "Weiterleitung auf die Stadtseite.",
      seitenkonfiguration: settings({
        path: "/halteverbot-hamburg-bestellen.html",
        redirect: "/halteverbotszone/stadt/hamburg/",
        redirectDate: "2026-10-29T09:25:00.000Z",
        note: "Migration Stadtseiten",
        sitemap: false,
      }),
      body: [
        {
          component: "services_section",
          _uid: "hh-nav",
          title: textDoc("Navigation"),
          services: [
            serviceLink("Alle Standorte", "Alle Standorte", "/halteverbotszone/stadt/berlin/"),
            serviceLink("Events", "Events", "/halteverbot-events/"),
          ],
        },
      ],
    },
  }),
  story({
    id: 106,
    uuid: "story-container",
    name: "Containerstellung",
    slug: "halteverbot-container",
    full_slug: "halteverbot-container",
    updated_at: "2026-11-07T09:05:00.000Z",
    content: {
      component: "anlass_page",
      seo_title: "Containerstellung",
      seo_description: "Halteverbot für Container.",
      seitenkonfiguration: settings({ path: "/halteverbot-container/", tracking: { zoho: true } }),
      body: [
        {
          component: "services_section",
          _uid: "container-links",
          title: textDoc("Verwandte Leistungen"),
          services: [
            serviceLink("Baustellenabsicherung", "Baustellenabsicherung", "/verkehrssicherung/baustellenabsicherung/"),
            serviceLink("Halteverbot beantragen", "Halteverbot beantragen", "/halteverbotszone/stadt/berlin/"),
          ],
        },
        { component: "seo_text", _uid: "container-din", title: "Fachinformation", content: linkDoc("Normen & Regelwerke", "https://www.din.de/", "nofollow") },
      ],
    },
  }),
  story({
    id: 107,
    uuid: "story-events",
    name: "Events & Veranstaltungen",
    slug: "halteverbot-events",
    full_slug: "halteverbot-events",
    updated_at: "2026-11-03T15:00:00.000Z",
    content: {
      component: "anlass_page",
      seo_title: "Events & Veranstaltungen",
      seo_description: "Halteverbot für Veranstaltungen.",
      seitenkonfiguration: settings({ path: "/halteverbot-events/", note: "Neue Anlassseite" }),
      body: [
        {
          component: "services_section",
          _uid: "events-links",
          title: textDoc("Leistungsblock"),
          services: [
            serviceLink("Halteverbotszone Berlin", "Halteverbotszone Berlin", "/halteverbotszone/stadt/berlin/"),
            serviceLink("Containerstellung", "Containerstellung", "/halteverbot-container/"),
          ],
        },
        { component: "seo_text", _uid: "events-info", title: "Infobox", content: linkDoc("Veranstaltungshinweise", "https://www.berlin.de/", "nofollow") },
      ],
    },
  }),
  story({
    id: 108,
    uuid: "story-entruempelung",
    name: "Entrümpelung – Entwurf",
    slug: "entruempelung",
    full_slug: "entruempelung",
    updated_at: "2026-11-07T08:10:00.000Z",
    published: false,
    content: {
      component: "page",
      seo_title: "Entrümpelung",
      seo_description: "",
      seitenkonfiguration: settings({
        path: "",
        note: "Real Path noch nicht hinterlegt",
        index: false,
        follow: false,
        sitemap: false,
        tracking: { gtm: false, meta: false, zoho: false },
      }),
      body: [],
    },
  }),
];

export function mockLinkStatus(sourceId: string, href: string): number {
  const normalized = href.replace(/\/+$/, "");
  if (sourceId === "102" && normalized.endsWith("/halteverbotszone/stadt/berlin")) return 301;
  if (normalized.includes("fahrbahnmarkierungen")) return 404;
  if (normalized.includes("baustellenschutz")) return 410;
  if (normalized.includes("baustellensicherung-alt")) return 404;
  return 200;
}
