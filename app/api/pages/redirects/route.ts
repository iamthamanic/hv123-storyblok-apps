import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { source?: string; target?: string; note?: string } | null;
  if (!body?.source || !body.target) return Response.json({ error: "Quelle und Ziel sind erforderlich." }, { status: 400 });
  return api(request, async (repo) => ({ page: await repo.createRedirect({ source: body.source!, target: body.target!, note: body.note }) }), true);
}
