// GET /api/crawl/runs/{runId}/logs?after_id=&limit= — log live, poll TĂNG DẦN (chỉ dòng có id > after_id).
import type { NextRequest } from "next/server";
import { getCrawlLogs } from "@/lib/api/crawl";
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
  return crawlReadRoute(() => getCrawlLogs(runId, { afterId, limit }));
}
