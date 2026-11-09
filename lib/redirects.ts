/**
 * 301-Weiterleitungen: Datum setzen, Schleifen erkennen, Pfade vergleichen.
 */

export type RedirectRow = {
  id: string;
  realPath: string;
  redirectUrl: string;
};

export function isValidPublicPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return !/\s/.test(trimmed);
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeLocation(value: string, domain: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, `https://${domain}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${path}${url.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "") || "/";
  }
}

export function applyRedirectEdit(
  current: { redirectUrl: string; redirectDate: string },
  nextUrl: string,
  nowIso: string,
): { redirectUrl: string; redirectDate: string } {
  const url = nextUrl.trim();
  if (!url) return { redirectUrl: "", redirectDate: "" };
  if (current.redirectUrl.trim()) {
    return { redirectUrl: url, redirectDate: current.redirectDate || nowIso };
  }
  return { redirectUrl: url, redirectDate: nowIso };
}

export function findRedirectLoop(rows: RedirectRow[], sourceId: string, sourcePath: string, target: string, domain: string): string | null {
  const sourceKey = normalizeLocation(sourcePath, domain);
  const targetKey = normalizeLocation(target, domain);
  if (!sourceKey || !targetKey) return null;
  if (sourceKey === targetKey) return "Quelle und Ziel dürfen nicht identisch sein.";

  const byPath = new Map<string, RedirectRow>();
  for (const row of rows) {
    if (!row.realPath || !row.redirectUrl) continue;
    byPath.set(normalizeLocation(row.realPath, domain), row);
  }
  byPath.set(sourceKey, { id: sourceId, realPath: sourcePath, redirectUrl: target });

  const seen = new Set<string>([sourceKey]);
  let step = targetKey;
  for (let i = 0; i < rows.length + 2; i += 1) {
    if (seen.has(step)) return "Eine Weiterleitungsschleife wurde erkannt.";
    seen.add(step);
    const next = byPath.get(step);
    if (!next?.redirectUrl) return null;
    step = normalizeLocation(next.redirectUrl, domain);
  }
  return "Eine Weiterleitungsschleife wurde erkannt.";
}
