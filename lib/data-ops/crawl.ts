// lib/data-ops/crawl.ts
// Phần THUẦN của nhóm Crawl (type, stats, checklist) — không gọi mạng, không
// import server-only, nên Client Component (form crawl, log live, bảng lịch sử)
// import trực tiếp được. Lời gọi API nằm ở lib/api/crawl.ts.

import type { components } from "@/lib/api/types";

export type CrawlRun = components["schemas"]["CrawlStatusOut"];
export type CrawlBatchRequest = components["schemas"]["CrawlBatchRequest"];
export type CrawlBatchAccepted = components["schemas"]["CrawlBatchAccepted"];
export type CrawlBatchStatus = components["schemas"]["CrawlBatchStatusOut"];
export type CrawlBatchSummary = components["schemas"]["CrawlBatchSummaryOut"];
export type CrawlLogLine = components["schemas"]["CrawlLogOut"];
export type CrawlLogs = components["schemas"]["CrawlLogsOut"];
export type PaginatedCrawlRuns = components["schemas"]["PaginatedCrawlRuns"];
export type PaginatedCrawlBatches = components["schemas"]["PaginatedCrawlBatches"];

/** Trạng thái run/batch ở backend. Batch không có "queued". */
export type CrawlRunStatus = "queued" | "running" | "done" | "error";

/** Run còn đang chạy (chưa kết thúc) — dùng để quyết định có polling tiếp. */
export function isCrawlRunActive(status: string): boolean {
  return status === "queued" || status === "running";
}

/**
 * `stats` của 1 run crawl (CrawlRun.stats) — chỉ có khi status done, hoặc
 * kèm `blocked: true` khi bị chặn giữa chừng (status vẫn "error"). Backend
 * khai `stats` là dict tự do nên type viết tay theo PipelineStats.to_dict()
 * (scrapjd/pipeline_stats.py).
 *
 * Các khoá optional CHỈ xuất hiện khi > 0 / có giá trị (xem _OPTIONAL_KEYS)
 * -> luôn đọc kiểu `stats.repost_reopened ?? 0`, đừng giả định có mặt.
 */
export interface CrawlStats {
  fetched: number;
  inserted: number;
  /** Trùng theo source_url. */
  skipped_duplicate: number;
  /** Tin đăng lại dưới URL mới (khác skipped_duplicate). */
  skipped_duplicate_repost: number;
  repost_deadline_extended: number;
  updated_existing: number;
  skipped_fetch_failed: number;
  errors: number;
  skipped_anonymous_employer: number;
  skipped_known_url: number;
  // --- chỉ xuất hiện khi có giá trị ---
  repost_reopened?: number;
  repost_kept_closed?: number;
  skipped_detail_unavailable?: number;
  updated_by_job_code?: number;
  linked_by_job_code_only?: number;
  job_code_title_mismatch?: number;
  /** Tỷ lệ trường rỗng, cấu trúc xem scrapjd/field_stats.py. */
  field_empty?: Record<string, unknown>;
  /** Lượt xong (status done) nhưng dữ liệu nghi hỏng: { reasons: string[] }. */
  degraded?: { reasons?: string[] } & Record<string, unknown>;
  /** Bị chặn (trang đầu thất bại / ngắt mạch) — kèm status "error". */
  blocked?: boolean;
}

/** `progress` (heartbeat khi đang chạy) — null/undefined khi chưa có. */
export interface CrawlProgress {
  fetched: number;
  inserted: number;
  /** ISO string — thời điểm heartbeat gần nhất. */
  last_update: string;
}

/** Đọc `stats` của run theo CrawlStats; không phải object -> null. */
export function readCrawlStats(run: Pick<CrawlRun, "stats">): CrawlStats | null {
  const s = run.stats;
  if (!s || typeof s !== "object") return null;
  return s as unknown as CrawlStats;
}

/** Đọc `progress` của run theo CrawlProgress; chưa có -> null (không phải lỗi). */
export function readCrawlProgress(run: Pick<CrawlRun, "progress">): CrawlProgress | null {
  const p = run.progress;
  if (!p || typeof p !== "object") return null;
  return p as unknown as CrawlProgress;
}

/** Giới hạn của form kích hoạt (khớp CrawlBatchRequest ở backend). */
export const CRAWL_PAGES_MIN = 1;
export const CRAWL_PAGES_MAX = 20;
export const CRAWL_MAX_JOBS_MIN = 1;
export const CRAWL_MAX_JOBS_MAX = 1000;

export type BatchChecklistState = "waiting" | CrawlRunStatus;

export interface BatchChecklistItem {
  category: string;
  /** "waiting" = chưa có record (chưa tới lượt). */
  state: BatchChecklistState;
  /** Run tương ứng; undefined khi state = "waiting". */
  run?: CrawlRun;
}

/**
 * Checklist category của 1 batch, THEO THỨ TỰ `batch.categories`, khớp với
 * `batch.items` bằng TÊN category (không theo vị trí mảng). Category chưa có
 * record -> "waiting". Hàm thuần, dùng được ở cả client lẫn server.
 */
export function buildBatchChecklist(
  batch: Pick<CrawlBatchStatus, "categories" | "items">,
): BatchChecklistItem[] {
  const byCategory = new Map<string, CrawlRun>();
  for (const run of batch.items) byCategory.set(run.category, run);
  return batch.categories.map((category) => {
    const run = byCategory.get(category);
    return run
      ? { category, state: run.status as CrawlRunStatus, run }
      : { category, state: "waiting" as const };
  });
}
