/**
 * OAuth-Endpunkte der Space App Scriptverwaltung.
 * Callback: {APP_URL}/api/connect/scriptverwaltung/callback
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { authHandler } from "@storyblok/app-extension-auth";
import { buildAuthParams } from "@/lib/auth/params";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const params = buildAuthParams("scriptverwaltung");
  if (!params) {
    res.status(501).json({ error: "OAuth für Scriptverwaltung ist nicht konfiguriert." });
    return;
  }
  return authHandler(params)(req, res);
}
