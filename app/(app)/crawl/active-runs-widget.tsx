"use client";
// app/(app)/crawl/active-runs-widget.tsx
// Widget "Đang chạy" — MỘT nguồn dữ liệu dùng chung (GET /api/crawl/active gộp crawl + bảo trì), mỗi tab chỉ chọn
// phạm vi hiện (tab Crawl hiện bảo trì, tab Bảo trì hiện crawl, tab Tình trạng dữ liệu hiện cả hai; xem
// activeRunsScopeForTab). Không viết riêng từng tab như bản Flask. Chỉ được dựng ở tab có polling; tab Lịch sử
// không dựng nó nên không có request nào.
//
// Chu kỳ 6 giây (mốc của tab Crawl bản Flask). Rỗng thì không chiếm chỗ.

import { formatShortDateTimeVN } from "@/lib/date";
import { maintenanceJobLabel } from "@/lib/data-ops/crawl-ui";
import { selectActiveRuns, type ActiveRunItem, type ActiveRunsPayload } from "@/lib/data-ops/active-runs";
import type { ActiveRunsScope } from "@/lib/data-ops/crawl-tabs";
import { RunStatusBadge } from "./run-status-badge";
import { usePolledJson } from "./use-polled-json";

export const ACTIVE_RUNS_ENDPOINT = "/api/crawl/active";
export const ACTIVE_RUNS_INTERVAL_MS = 6_000;

function describe(item: ActiveRunItem): string {
  return item.kind === "crawl"
    ? `Crawl ${item.source} · ${item.category}${item.batchPosition ? ` (mục ${item.batchPosition} của batch)` : ""}`
    : `Bảo trì · ${maintenanceJobLabel(item.jobType)}`;
}

export function ActiveRunsWidget({ scope }: { scope: ActiveRunsScope }) {
  const { data, error, stopped } = usePolledJson<ActiveRunsPayload>(ACTIVE_RUNS_ENDPOINT, {
    intervalMs: ACTIVE_RUNS_INTERVAL_MS,
  });

  const items = selectActiveRuns(data, scope);

  if (stopped) {
    return (
      <p role="status" className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Không còn cập nhật danh sách đang chạy (phiên hết hạn hoặc không đủ quyền). Tải lại trang để thử lại.
      </p>
    );
  }
  if (items.length === 0) {
    // Lỗi tạm thời mà chưa có dữ liệu nào: nói thẳng, đừng giả vờ "không có gì đang chạy".
    if (error && !data) {
      return (
        <p role="status" className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Chưa lấy được danh sách đang chạy, đang thử lại…
        </p>
      );
    }
    return null;
  }

  return (
    <section aria-label="Đang chạy" data-testid="active-runs" className="rounded-md border bg-muted/30 p-4">
      <h2 className="mb-2 text-sm font-semibold">Đang chạy ({items.length})</h2>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={`${item.kind}-${item.runId}`} className="flex flex-wrap items-center gap-2 text-sm">
            <RunStatusBadge status={item.status} />
            <span>{describe(item)}</span>
            <span className="text-muted-foreground">
              · bắt đầu {formatShortDateTimeVN(item.startedAt)}
              {item.triggeredByName ? ` · ${item.triggeredByName}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
