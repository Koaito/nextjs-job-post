// GET /api/crawl/latest-run — run crawl gần nhất để khung "Log live" có run_id ngay khi mở tab.
// `{ run: null }` khi chưa từng crawl lần nào: hợp lệ, KHÔNG phải lỗi (đừng suy run_id từ danh sách lịch sử).
import { getLatestCrawlLogRun } from "@/lib/api/crawl";
import { crawlReadRoute } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET() {
  return crawlReadRoute(async () => ({ run: await getLatestCrawlLogRun() }));
}
