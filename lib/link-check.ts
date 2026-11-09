/**
 * HTTP-Status öffentlicher URLs. Nur serverseitig; Host-Filter + DNS-Pin gegen private Ziele.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicHttpUrl } from "@/lib/http-status";

const PRIVATE_V4 = /^(127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

function isBlockedAddress(address: string): boolean {
  const host = address.toLowerCase();
  if (host === "::1" || host === "0.0.0.0") return true;
  if (PRIVATE_V4.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    const mapped = host.slice("::ffff:".length);
    if (PRIVATE_V4.test(mapped)) return true;
  }
  // IPv6 ULA fc00::/7, link-local fe80::/10 — global unicast IPv6 bleibt erlaubt
  if (/^(fc|fd)[0-9a-f]{0,2}:/i.test(host) || /^fe[89ab][0-9a-f]:/i.test(host)) return true;
  return false;
}

/** DNS auflösen und private/ULA-Adressen ablehnen (SSRF). */
export async function isSafePublicHttpUrl(url: string): Promise<boolean> {
  if (!isPublicHttpUrl(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isBlockedAddress(host);
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    if (!results.length) return false;
    return results.every((row) => !isBlockedAddress(row.address));
  } catch {
    return false;
  }
}

export async function fetchHttpStatus(url: string): Promise<number | null> {
  if (!(await isSafePublicHttpUrl(url))) return null;
  const once = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(6_000),
      headers: { "User-Agent": "Halteverbot123-SeitenCheck/1.0" },
    });
    return response.status;
  };
  try {
    const head = await once("HEAD");
    if (head === 405 || head === 501) return await once("GET");
    return head;
  } catch (error) {
    console.error("[link-check]", url, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>, shouldStop?: () => boolean): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      if (shouldStop?.()) return;
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
