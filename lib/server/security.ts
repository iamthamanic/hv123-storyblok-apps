/**
 * Request-Härtung: Origin/CSRF, Client-IP, Sicherheits-Logs.
 * Ort: /lib/server/security.ts
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function clientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production";
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "direct";
}

function allowedOrigins(): string[] {
  const origins = new Set<string>(["https://app.storyblok.com"]);
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) origins.add(appUrl);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://127.0.0.1:43123");
    origins.add("http://localhost:43123");
  }
  for (const extra of (process.env.ALLOWED_ORIGINS || "").split(",")) {
    const value = extra.trim().replace(/\/$/, "");
    if (value) origins.add(value);
  }
  return [...origins];
}

/** Schreibende Requests: Origin erlauben oder same-origin Sec-Fetch-Site. */
export function assertMutatingOrigin(request: Request): void {
  if (!MUTATING.has(request.method.toUpperCase())) return;
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return;
  const origin = request.headers.get("origin");
  if (!origin) {
    // Browser-less / same-origin navigations without Origin: allow only when not cross-site marked
    if (site === "cross-site") {
      throw Object.assign(new Error("Cross-Site-Anfrage abgelehnt."), { status: 403, code: "csrf" });
    }
    return;
  }
  const allowed = allowedOrigins();
  const normalized = origin.replace(/\/$/, "");
  if (allowed.includes(normalized)) return;
  // Storyblok preview / regional app hosts
  try {
    const host = new URL(origin).hostname;
    if (host === "app.storyblok.com" || host.endsWith(".storyblok.com")) return;
  } catch {
    /* ignore */
  }
  throw Object.assign(new Error("Origin nicht erlaubt."), { status: 403, code: "csrf" });
}

export function securityLog(event: string, details: Record<string, string | number | boolean | undefined>): void {
  console.info(JSON.stringify({ ts: new Date().toISOString(), event, ...details }));
}
