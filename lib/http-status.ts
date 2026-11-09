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

/** IPv4-mapped IPv6 (::ffff:a.b.c.d) und IPv4-kompatible Formen. */
function mappedIpv4(host: string): string | null {
  const mapped = host.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1]!;
  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const hi = Number.parseInt(hex[1]!, 16);
    const lo = Number.parseInt(hex[2]!, 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isPrivateOrLocalHost(host: string): boolean {
  if (!host || host === "localhost" || host === "::1" || host === "0.0.0.0") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (PRIVATE_V4.test(host)) return true;
  const v4 = mappedIpv4(host);
  if (v4 && PRIVATE_V4.test(v4)) return true;
  // IPv6 ULA fc00::/7, link-local fe80::/10, loopback ::1 already handled
  if (/^(fc|fd)[0-9a-f]{0,2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;
  if (host.includes(":")) {
    // andere IPv6-Literale ohne DNS-Pin: konservativ ablehnen (nur Hostnamen erlauben)
    return true;
  }
  return false;
}

/** Verhindert Checks gegen Loopback, Link-Local, ULA und private Netze. */
export function isPublicHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isPrivateOrLocalHost(host)) return false;
  return true;
}
