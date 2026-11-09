/**
 * Liest die OAuth-Session aus dem Cookie, das @storyblok/app-extension-auth setzt.
 */

import http from "node:http";
import { Socket } from "node:net";
import { getSessionStore, type AppSession } from "@storyblok/app-extension-auth";
import { buildAuthParams, type AppKey } from "@/lib/auth/params";

export async function readOauthSession(request: Request): Promise<{ session: AppSession; cookies: string[] } | null> {
  const apps: AppKey[] = ["seiten-check", "scriptverwaltung"];
  for (const app of apps) {
    const params = buildAuthParams(app);
    if (!params) continue;
    const req = new http.IncomingMessage(new Socket());
    req.headers.cookie = request.headers.get("cookie") ?? "";
    req.url = request.url;
    const res = new http.ServerResponse(req);
    const store = getSessionStore(params)({ req, res });
    const url = new URL(request.url);
    const spaceId = url.searchParams.get("space_id");
    const userId = url.searchParams.get("user_id");
    let session: AppSession | undefined;
    if (spaceId && userId) session = await store.get({ spaceId, userId });
    else if (store.getAll) {
      const all = await store.getAll();
      session = all[0];
    }
    const header = res.getHeader("set-cookie");
    const cookies = header == null ? [] : (Array.isArray(header) ? header : [header]).map(String);
    if (session) return { session, cookies };
  }
  return null;
}
