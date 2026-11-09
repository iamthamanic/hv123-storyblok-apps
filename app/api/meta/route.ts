/**
 * Öffentliche Laufzeitinfo: Modus, Space und Feld-Mapping. Keine Tokens.
 */
import { NextResponse } from "next/server";
import fieldMapping from "@/config/field-mapping.json";
import schemaGap from "@/config/schema-gap.json";
import { resolveMode } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    mode: resolveMode(),
    spaceId: process.env.STORYBLOK_SPACE_ID || fieldMapping.spaceId,
    region: fieldMapping.region,
    managementApiBase: fieldMapping.managementApiBase,
    pageSettingsField: fieldMapping.pageSettings.field,
    pageSettingsFieldType: fieldMapping.pageSettings.fieldType,
    scriptCatalog: fieldMapping.scriptCatalog.fullSlug,
    redirectCatalog: fieldMapping.manualRedirects.fullSlug,
    domains: fieldMapping.domains,
    missingInsideCustomField: Object.values(fieldMapping.pageSettings.keys).map((spec) => spec.key),
    rootsWithoutSeoTitle: schemaGap.rootsWithoutSeoTitle,
    seoNoindexOnlyOn: schemaGap.seoNoindexComponents,
    catalogComponentExists: fieldMapping.scriptCatalog.componentExistsInSpaceSchema,
  });
}
