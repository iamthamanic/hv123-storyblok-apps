/**
 * Browser-Client für die eigenen API-Routen. Leitet space_id und user_id aus der Iframe-URL mit.
 * Ort: /components/shared/client-api.ts
 */

export async function clientApi<T>(path: string, init?: RequestInit): Promise<T> {
  const extra = typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, "");
  const url = extra ? `${path}${path.includes("?") ? "&" : "?"}${extra}` : path;
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!response.ok) {
    const error = new Error(body.error || "Anfrage fehlgeschlagen") as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body as T;
}

export function formatDeDate(value: string): string {
  if (!value) return "–";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
