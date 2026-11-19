// lib/api/active-runs.ts
// Nguồn "Đang chạy" dùng chung (crawl + bảo trì) cho widget ở nhiều tab của /crawl. Quyền: staff
// (backend ss_team) — nơi gọi (Route Handler /api/crawl/active) không tự kiểm, để backend là nơi quyết định.
//
// Backend không có endpoint "đang chạy": GET /crawl?status= và GET /maintenance?status= mỗi lần lọc MỘT status,
// nên "đang chạy" = queued + running của cả hai => 4 lời gọi SONG SONG. Session của app là token không xoay
// vòng (không có bước refresh giữa chừng), nên Promise.all an toàn: một lệnh 401 là cả lượt 401, không có
// nhiều lượt refresh chồng nhau. Một lệnh lỗi thì cả lượt lỗi (widget hiện lỗi chung, không hiện nửa vời).

import { listCrawlRuns } from "@/lib/api/crawl";
import { listMaintenanceRuns } from "@/lib/api/maintenance";
import {
  ACTIVE_RUNS_FETCH_LIMIT,
  mergeActiveCrawl,
  mergeActiveMaintenance,
  type ActiveRunsPayload,
} from "@/lib/data-ops/active-runs";

export async function getActiveRuns(): Promise<ActiveRunsPayload> {
  const limit = ACTIVE_RUNS_FETCH_LIMIT;
  const [crawlQueued, crawlRunning, maintQueued, maintRunning] = await Promise.all([
    listCrawlRuns({ status: "queued", limit }),
    listCrawlRuns({ status: "running", limit }),
    listMaintenanceRuns({ status: "queued", limit }),
    listMaintenanceRuns({ status: "running", limit }),
  ]);
  return {
    crawl: mergeActiveCrawl(crawlQueued.items, crawlRunning.items),
    maintenance: mergeActiveMaintenance(maintQueued.items, maintRunning.items),
  };
}
