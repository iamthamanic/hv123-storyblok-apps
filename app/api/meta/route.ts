/**
 * Laufzeitinfo für die UI. In Production nur mit gültiger Session (oder Mock lokal).
 */
import { NextResponse } from "next/server";
import fieldMapping from "@/config/field-mapping.json";
import { AuthRequiredError, repositoryFor } from "@/lib/server/context";
import { resolveMode } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = resolveMode();
  if (mode !== "mock") {
    try {
      await repositoryFor(request);
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
      }
      throw error;
    }
  }

  const publicPayload = {
    mode,
    region: fieldMapping.region,
    pageSettingsField: fieldMapping.pageSettings.field,
  };

  // PAT in production: only mode/region — no recon surface without opt-in writes.
  if (mode === "pat" && process.env.NODE_ENV === "production" && process.env.ALLOW_PAT_WRITES !== "true") {
    return NextResponse.json(publicPayload);
  }

  return NextResponse.json({
    ...publicPayload,
    spaceId: process.env.STORYBLOK_SPACE_ID || fieldMapping.spaceId,
    managementApiBase: fieldMapping.managementApiBase,
    pageSettingsFieldType: fieldMapping.pageSettings.fieldType,
    scriptCatalog: fieldMapping.scriptCatalog.fullSlug,
    redirectCatalog: fieldMapping.manualRedirects.fullSlug,
    domains: fieldMapping.domains,
  });
}
