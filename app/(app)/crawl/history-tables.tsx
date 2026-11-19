// app/(app)/crawl/history-tables.tsx
// Hai bảng của tab Lịch sử: crawl và bảo trì. Server Component thuần (chỉ hiển thị; phân trang/lọc qua URL).

import { formatDateTimeVN } from "@/lib/date";
import {
  crawlStatsSummary,
  formatDuration,
  maintenanceJobLabel,
  maintenanceParamsSummary,
  maintenanceStatsSummary,
} from "@/lib/data-ops/crawl-ui";
import type { CrawlRun } from "@/lib/data-ops/crawl";
import type { MaintenanceStatus } from "@/lib/data-ops/maintenance";
import { RunStatusBadge } from "./run-status-badge";

const TABLE_WRAP = "overflow-x-auto rounded-md border";
const TH = "px-3 py-2 font-medium";
const TD = "px-3 py-2 align-top";

/** Cột "Kết quả": số liệu nếu có; lỗi thì kèm nội dung lỗi (cắt gọn, đủ nội dung trong title). */
function ResultCell({ summary, error }: { summary: string | null; error: string | null | undefined }) {
  return (
    <td className={`${TD} max-w-sm`}>
      {summary ? <div>{summary}</div> : null}
      {error ? (
        <div className="truncate text-red-700 dark:text-red-300" title={error}>
          {error}
        </div>
      ) : null}
      {!summary && !error ? <span className="text-muted-foreground">—</span> : null}
    </td>
  );
}

export function CrawlRunsTable({ runs, emptyText }: { runs: CrawlRun[]; emptyText: string }) {
  if (runs.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className={TABLE_WRAP}>
      <table aria-label="Lịch sử crawl" className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className={TH}>Bắt đầu</th>
            <th className={TH}>Nguồn</th>
            <th className={TH}>Danh mục</th>
            <th className={TH}>Trạng thái</th>
            <th className={TH}>Kết quả</th>
            <th className={TH}>Thời lượng</th>
            <th className={TH}>Người chạy</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.run_id} className="border-b last:border-0" data-run-id={run.run_id}>
              <td className={`${TD} whitespace-nowrap`}>{formatDateTimeVN(run.started_at)}</td>
              <td className={TD}>{run.source}</td>
              <td className={TD}>{run.category}</td>
              <td className={TD}>
                <RunStatusBadge status={run.status} />
              </td>
              <ResultCell summary={crawlStatsSummary(run)} error={run.error} />
              <td className={`${TD} whitespace-nowrap`}>{formatDuration(run.started_at, run.finished_at) ?? "—"}</td>
              <td className={TD}>{run.triggered_by_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MaintenanceRunsTable({ runs, emptyText }: { runs: MaintenanceStatus[]; emptyText: string }) {
  if (runs.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className={TABLE_WRAP}>
      <table aria-label="Lịch sử bảo trì" className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className={TH}>Bắt đầu</th>
            <th className={TH}>Công việc</th>
            <th className={TH}>Tham số</th>
            <th className={TH}>Trạng thái</th>
            <th className={TH}>Kết quả</th>
            <th className={TH}>Thời lượng</th>
            <th className={TH}>Người chạy</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.run_id} className="border-b last:border-0" data-run-id={run.run_id}>
              <td className={`${TD} whitespace-nowrap`}>{formatDateTimeVN(run.started_at)}</td>
              <td className={TD}>{maintenanceJobLabel(run.job_type)}</td>
              <td className={TD}>{maintenanceParamsSummary(run.params) ?? "—"}</td>
              <td className={TD}>
                <RunStatusBadge status={run.status} />
              </td>
              <ResultCell summary={maintenanceStatsSummary(run)} error={run.error} />
              <td className={`${TD} whitespace-nowrap`}>{formatDuration(run.started_at, run.finished_at) ?? "—"}</td>
              <td className={TD}>{run.triggered_by_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
