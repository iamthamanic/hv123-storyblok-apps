/**
 * Einheitliche JSON-Antworten, Protokoll und ein einfaches Request-Limit.
 */

import { NextResponse } from "next/server";
import { AppError } from "@/lib/repository";
import { AuthRequiredError, repositoryFor } from "@/lib/server/context";
import { StoryblokError } from "@/lib/storyblok/client";

const hits = new Map<string, { count: number; at: number }>();

function allowed(request: Request, write: boolean): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${write ? "w" : "r"}`;
  const now = Date.now();
  const current = hits.get(key);
  const limit = write ? 60 : 180;
  if (!current || now - current.at > 60_000) {
    hits.set(key, { count: 1, at: now });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

export async function api(request: Request, run: (repo: Awaited<ReturnType<typeof repositoryFor>>["repo"]) => Promise<unknown>, write = false) {
  if (!allowed(request, write)) {
    return NextResponse.json({ error: "Zu viele Anfragen. Bitte kurz warten." }, { status: 429 });
  }
  try {
    const { repo, cookies } = await repositoryFor(request);
    const data = await run(repo);
    const response = NextResponse.json(data);
    for (const cookie of cookies) response.headers.append("set-cookie", cookie);
    return response;
  } catch (error) {
    console.error("[api]", error instanceof Error ? error.message : error);
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    }
    if (error instanceof AppError || error instanceof StoryblokError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unerwarteter Fehler.";
    return NextResponse.json({ error: message }, { status });
  }
}
