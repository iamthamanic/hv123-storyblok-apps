import type { ScriptRecord } from "@/lib/types";
import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(request, async (repo) => ({ mode: repo.mode, scripts: await repo.listScripts() }));
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { scripts?: ScriptRecord[] } | null;
  if (!Array.isArray(body?.scripts)) return Response.json({ error: "Scriptliste fehlt." }, { status: 400 });
  return api(request, async (repo) => ({ scripts: await repo.saveScripts(body.scripts!) }), true);
}
