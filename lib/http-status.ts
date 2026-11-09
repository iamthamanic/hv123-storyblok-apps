/**
 * Welche HTTP-Status als defekte Links gelten.
 * Das Modal zeigt nur 404 und 410. Andere Codes bleiben in der Linkliste sichtbar.
 */

export type BrokenType = "404" | "410";

export function brokenErrorType(status: number | null | undefined): BrokenType | null {
  if (status === 404) return "404";
  if (status === 410) return "410";
  return null;
}

export function isBrokenStatus(status: number | null | undefined): boolean {
  return brokenErrorType(status) !== null;
}

export function brokenMessage(status: BrokenType): string {
  return status === "404" ? "Seite existiert nicht" : "Seite dauerhaft entfernt";
}

const PRIVATE_V4 = /^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

/** Verhindert Checks gegen Loopback, Link-Local und private Netze. */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "::1" || host === "0.0.0.0") return false;
  if (PRIVATE_V4.test(host)) return false;
  return true;
}
