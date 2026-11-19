// GET /api/crawl/batches/{batchId} — tiến độ 1 batch (items, total, completed).
import type { NextRequest } from "next/server";
import { getCrawlBatch } from "@/lib/api/crawl";
import { crawlFail, crawlReadRoute, isUuid } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  if (!isUuid(batchId)) return crawlFail(400, "Mã batch không hợp lệ.");
  return crawlReadRoute(() => getCrawlBatch(batchId));
}
