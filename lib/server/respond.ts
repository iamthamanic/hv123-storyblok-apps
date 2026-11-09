/**
 * Einheitliche JSON-Antworten, Protokoll, Origin-Check und Request-Limit.
 */

import { NextResponse } from "next/server";
import { AppError } from "@/lib/repository";
import { AuthRequiredError, repositoryFor } from "@/lib/server/context";
import { assertMutatingOrigin, clientIp, securityLog } from "@/lib/server/security";
import { StoryblokError } from "@/lib/storyblok/client";
import { ValidationError } from "@/lib/scripts";

const hits = new Map<string, { count: number; at: number }>();
const CHECK_LINKS_LIMIT = 6;
const WRITE_LIMIT = 40;
const READ_LIMIT = 120;

function routeBucket(request: Request, write: boolean): { key: string; limit: number } {
  const ip = clientIp(request);
  const path = new URL(request.url).pathname;
  if (path.endsWith("/check-links")) return { key: `${ip}:check-links`, limit: CHECK_LINKS_LIMIT };
  if (write) return { key: `${ip}:w`, limit: WRITE_LIMIT };
  return { key: `${ip}:r`, limit: READ_LIMIT };
}

function allowed(request: Request, write: boolean): boolean {
  const { key, limit } = routeBucket(request, write);
  const now = Date.now();
  const current = hits.get(key);
  if (!current || now - current.at > 60_000) {
    hits.set(key, { count: 1, at: now });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function productionBlocksUnauthWrites(mode: string, write: boolean): string | null {
  if (!write || process.env.NODE_ENV !== "production") return null;
  if (mode === "pat" && process.env.ALLOW_PAT_WRITES !== "true") {
    return "PAT-Schreibzugriff in Production ist deaktiviert. OAuth nutzen oder ALLOW_PAT_WRITES=true setzen.";
  }
  if (mode === "mock" && process.env.ALLOW_MOCK_WRITES !== "true") {
    return "Mock-Schreibzugriff in Production ist deaktiviert.";
  }
  return null;
}

export async function api(request: Request, run: (repo: Awaited<ReturnType<typeof repositoryFor>>["repo"]) => Promise<unknown>, write = false) {
  try {
    assertMutatingOrigin(request);
  } catch (error) {
    securityLog("auth.csrf_denied", { ip: clientIp(request), path: new URL(request.url).pathname });
    const message = error instanceof Error ? error.message : "Anfrage abgelehnt.";
    return NextResponse.json({ error: message, code: "csrf" }, { status: 403 });
  }

  if (!allowed(request, write)) {
    securityLog("auth.rate_limited", { ip: clientIp(request), path: new URL(request.url).pathname, write });
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 });
  }

  try {
    const { repo, cookies } = await repositoryFor(request);
    const blocked = productionBlocksUnauthWrites(repo.mode, write);
    if (blocked) {
      securityLog("authz.denied", { ip: clientIp(request), mode: repo.mode, path: new URL(request.url).pathname });
      return NextResponse.json({ error: blocked }, { status: 403 });
    }
    const data = await run(repo);
    const response = NextResponse.json(data);
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    console.error("[api]", error instanceof Error ? error.message : error);
    if (error instanceof AuthRequiredError) {
      securityLog("auth.required", { ip: clientIp(request), path: new URL(request.url).pathname });
      return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    }
    if (error instanceof ValidationError || error instanceof AppError || error instanceof StoryblokError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    if (status >= 500) {
      return NextResponse.json({ error: "Unerwarteter Fehler." }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : "Anfrage abgelehnt.";
    return NextResponse.json({ error: message }, { status });
  }
}
