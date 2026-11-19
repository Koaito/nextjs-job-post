// GET /api/maintenance/runs/{runId}/logs?after_id=&limit= — log live của 1 run bảo trì, poll tăng dần.
import type { NextRequest } from "next/server";
import { getMaintenanceLogs } from "@/lib/api/maintenance";
import { crawlFail, crawlReadRoute, isUuid, parseLogLimit, parseNonNegInt } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  if (!isUuid(runId)) return crawlFail(400, "Mã lượt chạy không hợp lệ.");
  const sp = new URL(req.url).searchParams;
  const afterId = parseNonNegInt(sp.get("after_id"), 0);
  const limit = parseLogLimit(sp.get("limit"));
  if (afterId === null || limit === null) return crawlFail(400, "Tham số log không hợp lệ.");
  return crawlReadRoute(() => getMaintenanceLogs(runId, { afterId, limit }));
}
