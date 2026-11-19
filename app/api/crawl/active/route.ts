// GET /api/crawl/active — nguồn "Đang chạy" dùng chung (crawl + bảo trì) cho widget ở các tab của /crawl.
import { getActiveRuns } from "@/lib/api/active-runs";
import { crawlReadRoute } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET() {
  return crawlReadRoute(getActiveRuns);
}
