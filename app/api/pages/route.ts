import { api } from "@/lib/server/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(request, async (repo) => ({ mode: repo.mode, pages: await repo.listPages() }));
}
