/**
 * Prüft eine Seitenänderung, bevor sie in die Story oder den Redirect-Speicher geschrieben wird.
 */

import { findRedirectLoop, isValidPublicPath, type RedirectRow } from "@/lib/redirects";
import type { PageSettings } from "@/lib/mapping";

export function explainPageChange(id: string, next: PageSettings, rows: RedirectRow[]): string | null {
  if (next.realPath && !isValidPublicPath(next.realPath)) {
    return "Real Path muss mit / beginnen oder eine HTTPS-URL sein.";
  }
  if (next.canonical && !isValidPublicPath(next.canonical)) {
    return "Canonical muss mit / beginnen oder eine HTTPS-URL sein.";
  }
  if (next.domain && /[\s/]/.test(next.domain)) {
    return "Domain ohne Protokoll und ohne Pfad eintragen.";
  }
  if (next.redirectUrl && !next.realPath) {
    return "Für einen Redirect muss ein Real Path hinterlegt sein.";
  }
  if (next.redirectUrl && !isValidPublicPath(next.redirectUrl)) {
    return "Redirect-Ziel muss mit / oder https:// beginnen.";
  }
  if (next.redirectUrl) {
    return findRedirectLoop(rows, id, next.realPath, next.redirectUrl, next.domain);
  }
  return null;
}
