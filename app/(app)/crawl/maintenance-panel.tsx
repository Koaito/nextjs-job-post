"use client";
// app/(app)/crawl/maintenance-panel.tsx
// Khung tương tác của tab Bảo trì: 5 thẻ job. Hai nguồn poll DUY NHẤT cho cả tab (không phải 5+5 request):
//   - trạng thái/kết quả của cả 5 job: GET /api/maintenance/latest-runs (run gần nhất của mỗi job);
//   - log của cả 5 khung: GET /api/maintenance/logs-batch (useMaintenanceLogs).
// Chỉ poll khi còn job queued/running; xong hết là dừng. Bấm chạy xong gọi refresh() để thấy lượt mới ngay.

import { MAINTENANCE_JOB_TYPES } from "@/lib/data-ops/maintenance";
import { anyMaintenanceActive, type LatestMaintenanceRuns } from "@/lib/data-ops/maintenance-live";
import { MaintenanceJobCard } from "./maintenance-job-card";
import { useMaintenanceLogs } from "./use-maintenance-logs";
import { usePolledJson } from "./use-polled-json";

const POLL_MS = 3_000;
const NO_RUNS = {} as Partial<LatestMaintenanceRuns>;

export function MaintenancePanel({
  isAdmin,
  initialRuns,
}: {
  isAdmin: boolean;
  initialRuns: LatestMaintenanceRuns | null;
}) {
  const { data, error, stopped, refresh } = usePolledJson<{ runs: LatestMaintenanceRuns }>(
    "/api/maintenance/latest-runs",
    { intervalMs: (latest) => (anyMaintenanceActive(latest?.runs ?? initialRuns) ? POLL_MS : 0) },
  );
  // Chưa có phản hồi poll thì dùng dữ liệu server đã lấy sẵn; cả hai đều chưa có (lỗi) thì mọi thẻ là "chưa chạy".
  const runs = data?.runs ?? initialRuns ?? NO_RUNS;
  const active = anyMaintenanceActive(runs);
  const logs = useMaintenanceLogs(runs, active);
  const hasRuns = Boolean(data?.runs ?? initialRuns);

  return (
    <div className="space-y-6">
      {isAdmin ? null : (
        <p data-testid="maintenance-readonly-note" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Bạn có thể xem tiến độ, kết quả và log bảo trì. Chỉ admin mới được bấm chạy.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Mỗi job chỉ chạy một lượt tại một thời điểm. Hệ thống chạy tối đa 2 job nền cùng lúc (crawl và bảo trì cộng chung),
        nên một lượt mới có thể ở trạng thái &quot;Đang chờ&quot; một lúc. Mỗi người được bấm chạy tối đa 10 lượt mỗi giờ.
      </p>

      {stopped || logs.stopped ? (
        <p role="status" className="text-sm text-muted-foreground">
          Không còn cập nhật tiến độ (phiên hết hạn hoặc không đủ quyền). Tải lại trang để thử lại.
        </p>
      ) : error && !hasRuns ? (
        <p role="status" className="text-sm text-muted-foreground">
          Chưa lấy được lượt chạy gần nhất, đang thử lại…
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {MAINTENANCE_JOB_TYPES.map((jobType) => {
          const run = runs[jobType] ?? null;
          return (
            <MaintenanceJobCard
              key={jobType}
              jobType={jobType}
              run={run}
              isAdmin={isAdmin}
              logLines={run ? (logs.logs[run.run_id]?.lines ?? null) : null}
              onStarted={refresh}
            />
          );
        })}
      </div>
    </div>
  );
}
