// GET /api/crawl/runs/{runId} — trạng thái 1 run crawl (polling).
import type { NextRequest } from "next/server";
import { getCrawlRun } from "@/lib/api/crawl";
import { crawlFail, crawlReadRoute, isUuid } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  if (!isUuid(runId)) return crawlFail(400, "Mã lượt chạy không hợp lệ.");
  return crawlReadRoute(() => getCrawlRun(runId));
}
