/**
 * HTTP-Status öffentlicher URLs. Wird nur serverseitig und nur für http(s) auf öffentlichen Hosts genutzt.
 */

import { isPublicHttpUrl } from "@/lib/http-status";

export async function fetchHttpStatus(url: string): Promise<number | null> {
  if (!isPublicHttpUrl(url)) return null;
  const once = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Halteverbot123-SeitenCheck/1.0" },
    });
    return response.status;
  };
  try {
    const head = await once("HEAD");
    if (head === 405 || head === 501) return await once("GET");
    return head;
  } catch (error) {
    console.error("[link-check]", url, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
