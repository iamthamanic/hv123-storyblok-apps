import type { PagePatch } from "@/lib/types";
import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { patch?: PagePatch } | null;
  if (!body?.patch || typeof body.patch !== "object") {
    return Response.json({ error: "Patch fehlt." }, { status: 400 });
  }
  return api(request, async (repo) => ({ page: await repo.updatePage(id, body.patch!) }), true);
}
