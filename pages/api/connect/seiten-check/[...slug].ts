/**
 * OAuth-Endpunkte der Space App Seiten-Check.
 * Callback: {APP_URL}/api/connect/seiten-check/callback
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authHandler } from "@storyblok/app-extension-auth";
import { buildAuthParams } from "@/lib/auth/params";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const params = buildAuthParams("seiten-check");
  if (!params) {
    res.status(501).json({ error: "OAuth für Seiten-Check ist nicht konfiguriert." });
    return;
  }
  return authHandler(params)(req, res);
}
