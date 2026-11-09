/**
 * OAuth-Parameter je Space App. Secrets kommen nur aus der Umgebung.
 * Ort: /lib/auth/params.ts
 */

import type { AuthHandlerParams } from "@storyblok/app-extension-auth";

export type AppKey = "seiten-check" | "scriptverwaltung";

export function buildAuthParams(app: AppKey): AuthHandlerParams | null {
  const clientId = process.env[app === "seiten-check" ? "SEITENCHECK_CLIENT_ID" : "SCRIPTVERWALTUNG_CLIENT_ID"] || process.env.STORYBLOK_CLIENT_ID;
  const clientSecret = process.env[app === "seiten-check" ? "SEITENCHECK_CLIENT_SECRET" : "SCRIPTVERWALTUNG_CLIENT_SECRET"] || process.env.STORYBLOK_CLIENT_SECRET;
  const baseUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !baseUrl) return null;
  return {
    clientId,
    clientSecret,
    baseUrl,
    endpointPrefix: `api/connect/${app}`,
    successCallback: app === "seiten-check" ? "/seiten-check" : "/scriptverwaltung",
    errorCallback: "/oauth-fehler",
    sessionKey: `sb.${app}`,
  };
}
