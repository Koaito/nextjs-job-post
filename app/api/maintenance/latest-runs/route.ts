// GET /api/maintenance/latest-runs — run gần nhất của MỖI job_type trong một lần gọi: { runs: { [job_type]: run | null } }.
import { getLatestMaintenanceRuns } from "@/lib/api/maintenance";
import { crawlReadRoute } from "@/lib/crawl-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET() {
  return crawlReadRoute(async () => ({ runs: await getLatestMaintenanceRuns() }));
}
