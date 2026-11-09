import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(request, async (repo) => ({ pages: await repo.checkLinks(), mode: repo.mode }), true);
}
