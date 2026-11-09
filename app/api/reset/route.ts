import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(request, async (repo) => {
    await repo.reset();
    return { ok: true, mode: repo.mode };
  }, true);
}
