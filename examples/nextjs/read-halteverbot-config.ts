/**
 * Beispiel für das Website-Repo (Next.js App Router).
 * Liegt nicht in einer Route dieser Space Apps.
 * Die Website liest die Delivery API, nicht die Management API.
 */

import fieldMapping from "@/config/field-mapping.json";
import { readPageSettings } from "@/lib/mapping";
import { scriptsToLoad, type ConsentMap } from "@/lib/order";
import type { ScriptRecord } from "@/lib/types";

type StoryResponse = { story: { content: Record<string, unknown>; full_slug: string } };

const CDN = "https://api.storyblok.com/v2/cdn";

async function fetchStory(slug: string, token: string, version: "published" | "draft"): Promise<StoryResponse> {
  const response = await fetch(`${CDN}/stories/${slug}?token=${token}&version=${version}`, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Story ${slug} nicht lesbar (${response.status}).`);
  return response.json() as Promise<StoryResponse>;
}

export async function loadPageSeo(slug: string, token: string) {
  const { story } = await fetchStory(slug, token, "published");
  const component = typeof story.content.component === "string" ? story.content.component : null;
  const settings = readPageSettings(story.content, component, []);
  const robots = [`${settings.index ? "index" : "noindex"}`, `${settings.follow ? "follow" : "nofollow"}`].join(", ");
  return {
    realPath: settings.realPath,
    redirect: settings.redirectUrl ? { destination: settings.redirectUrl, permanent: true as const } : null,
    canonical: settings.canonical,
    robots,
    sitemap: settings.sitemap,
    tracking: settings.tracking,
    seoTitle: settings.seoTitle,
  };
}

export async function loadScriptsForPage(slug: string, token: string, consent: ConsentMap) {
  const [page, catalogStory] = await Promise.all([
    fetchStory(slug, token, "published"),
    fetchStory(fieldMapping.scriptCatalog.fullSlug, token, "published"),
  ]);
  const raw = catalogStory.story.content[fieldMapping.scriptCatalog.jsonField];
  const parsed = typeof raw === "string" ? JSON.parse(raw) as { scripts?: ScriptRecord[] } : null;
  const scripts = parsed?.scripts ?? [];
  const component = typeof page.story.content.component === "string" ? page.story.content.component : null;
  const settings = readPageSettings(page.story.content, component, scripts);
  return scriptsToLoad(scripts, settings.tracking, consent);
}
