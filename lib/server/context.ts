/**
 * Wählt Mock, Personal Access Token oder OAuth für einen Request.
 */

import fieldMapping from "@/config/field-mapping.json";
import { readOauthSession } from "@/lib/auth/session";
import { LiveRepository, MockRepository, resolveMode, type AppRepository } from "@/lib/repository";
import { StoryblokClient } from "@/lib/storyblok/client";
import type { Region } from "@storyblok/region-helper";

export class AuthRequiredError extends Error {
  status = 401;
  code = "auth";
  constructor() {
    super("Bitte die App in Storyblok öffnen und den Zugriff erlauben.");
    this.name = "AuthRequiredError";
  }
}

export function expectedSpaceId(): string {
  return process.env.STORYBLOK_SPACE_ID || fieldMapping.spaceId;
}

export async function repositoryFor(request: Request): Promise<{ repo: AppRepository; cookies: string[] }> {
  const mode = resolveMode();
  if (mode === "mock") return { repo: new MockRepository(), cookies: [] };
  if (mode === "pat") {
    const token = process.env.STORYBLOK_PAT;
    if (!token) throw new Error("STORYBLOK_PAT fehlt.");
    return { repo: new LiveRepository(new StoryblokClient(token, expectedSpaceId(), "eu", "pat"), "pat"), cookies: [] };
  }
  const found = await readOauthSession(request);
  if (!found) throw new AuthRequiredError();
  if (String(found.session.spaceId) !== expectedSpaceId()) {
    throw Object.assign(new Error("Diese Installation gehört zu einem anderen Space."), { status: 403 });
  }
  const region = (found.session.region || "eu") as Region;
  return {
    repo: new LiveRepository(new StoryblokClient(found.session.accessToken, String(found.session.spaceId), region, "oauth"), "oauth"),
    cookies: found.cookies,
  };
}
