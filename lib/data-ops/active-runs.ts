// lib/data-ops/active-runs.ts
// Nguồn dữ liệu "Đang chạy" DÙNG CHUNG cho nhiều tab (crawl + bảo trì gộp một chỗ, plan 4.3), thay vì
// mỗi tab tự gộp theo domain của nó như bản Flask. Thuần: chỉ gộp/chuẩn hoá/lọc, không gọi mạng.
//
// Backend không có endpoint "danh sách run đang chạy": chỉ có GET /crawl?status= và GET /maintenance?status=
// mỗi lần lọc MỘT status, nên "đang chạy" = hợp của `queued` và `running` ở cả hai nơi
// (lib/api/active-runs.ts gọi 4 lời gọi song song rồi đưa vào đây).

import type { CrawlRun } from "@/lib/data-ops/crawl";
import { isMaintenanceJobType, type MaintenanceJobType, type MaintenanceStatus } from "@/lib/data-ops/maintenance";
import type { ActiveRunsScope } from "@/lib/data-ops/crawl-tabs";

export interface ActiveCrawlItem {
  kind: "crawl";
  runId: string;
  status: string;
  source: string;
  category: string;
  startedAt: string;
  triggeredByName: string | null;
  /** Vị trí trong batch (nếu chạy theo batch). */
  batchPosition: number | null;
}

export interface ActiveMaintenanceItem {
  kind: "maintenance";
  runId: string;
  status: string;
  jobType: MaintenanceJobType;
  startedAt: string;
  triggeredByName: string | null;
}

export type ActiveRunItem = ActiveCrawlItem | ActiveMaintenanceItem;

/** Payload JSON của GET /api/crawl/active. */
export interface ActiveRunsPayload {
  crawl: ActiveCrawlItem[];
  maintenance: ActiveMaintenanceItem[];
}

function byStartedAtThenId(a: { startedAt: string; runId: string }, b: { startedAt: string; runId: string }): number {
  if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? -1 : 1;
  return a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0;
}

/** Gộp nhiều trang kết quả (queued + running) thành danh sách duy nhất theo run_id, cũ nhất trước. */
export function mergeActiveCrawl(...lists: CrawlRun[][]): ActiveCrawlItem[] {
  const byId = new Map<string, ActiveCrawlItem>();
  for (const list of lists) {
    for (const run of list) {
      byId.set(run.run_id, {
        kind: "crawl",
        runId: run.run_id,
        status: run.status,
        source: run.source,
        category: run.category,
        startedAt: run.started_at,
        triggeredByName: run.triggered_by_name ?? null,
        batchPosition: run.batch_position ?? null,
      });
    }
  }
  return [...byId.values()].sort(byStartedAtThenId);
}

/** Như trên cho bảo trì; run có `job_type` lạ (backend thêm job mà frontend chưa biết) bị bỏ qua, không làm hỏng widget. */
export function mergeActiveMaintenance(...lists: MaintenanceStatus[][]): ActiveMaintenanceItem[] {
  const byId = new Map<string, ActiveMaintenanceItem>();
  for (const list of lists) {
    for (const run of list) {
      if (!isMaintenanceJobType(run.job_type)) continue;
      byId.set(run.run_id, {
        kind: "maintenance",
        runId: run.run_id,
        status: run.status,
        jobType: run.job_type,
        startedAt: run.started_at,
        triggeredByName: run.triggered_by_name ?? null,
      });
    }
  }
  return [...byId.values()].sort(byStartedAtThenId);
}

/** Lọc payload theo phạm vi widget của tab (xem activeRunsScopeForTab). */
export function selectActiveRuns(payload: ActiveRunsPayload | undefined, scope: ActiveRunsScope): ActiveRunItem[] {
  if (!payload) return [];
  const out: ActiveRunItem[] = [];
  if (scope === "crawl" || scope === "both") out.push(...payload.crawl);
  if (scope === "maintenance" || scope === "both") out.push(...payload.maintenance);
  return out;
}

/** Số lượt chạy backend trả về mỗi lời gọi; đủ cho "đang chạy" (mỗi nguồn/job_type tối đa 1 lượt đang chạy). */
export const ACTIVE_RUNS_FETCH_LIMIT = 50;
