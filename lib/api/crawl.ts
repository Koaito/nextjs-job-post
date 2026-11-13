// lib/api/crawl.ts
// Nhóm 6, tab "Crawl" + "Lịch sử" của /crawl. Tương đương crawler_client/crawl.py
// bên Flask.
//
// QUYỀN (khớp scrapjd/api/routers/crawl.py):
//   - CHẠY crawl (POST /crawl/batch)      -> require_admin  -> nơi gọi phải requireAdmin()
//   - XEM (mọi GET còn lại)               -> ss_team        -> nơi gọi requireStaff()
// File này KHÔNG tự check quyền (cùng quy ước các module lib/api/ khác) —
// chặn quyền ở Server Component / Server Action / Route Handler gọi vào.
//
// CHỈ có luồng BATCH: form crawl ở Next.js luôn đi qua POST /crawl/batch
// (checkbox chọn nhiều category, kể cả khi chỉ tick 1 ô). Route 1-category cũ
// POST /crawl còn ở backend nhưng không có UI nào gọi -> không khai ở đây.
//
// RATE LIMIT: POST /crawl/batch giới hạn 10 lượt/giờ theo user -> 429 (không
// có error_code, rơi vào "Dạng 3" của ApiError, chỉ có status 429). 409 =
// nguồn này đang có lượt chạy dở (error_code crawl_already_active...).

import { callAuthed } from "./client";
import type {
  CrawlBatchAccepted,
  CrawlBatchRequest,
  CrawlBatchStatus,
  CrawlLogs,
  CrawlRun,
  PaginatedCrawlBatches,
  PaginatedCrawlRuns,
} from "@/lib/data-ops/crawl";

// Type + hàm thuần (buildBatchChecklist, readCrawlStats, isCrawlRunActive...)
// nằm ở lib/data-ops/crawl.ts để Client Component import được; re-export type
// ở đây cho nơi gọi phía server tiện dùng.
export type {
  BatchChecklistItem,
  BatchChecklistState,
  CrawlBatchAccepted,
  CrawlBatchRequest,
  CrawlBatchStatus,
  CrawlBatchSummary,
  CrawlLogLine,
  CrawlLogs,
  CrawlProgress,
  CrawlRun,
  CrawlRunStatus,
  CrawlStats,
  PaginatedCrawlBatches,
  PaginatedCrawlRuns,
} from "@/lib/data-ops/crawl";

// ---------------------------------------------------------------------------
// Kích hoạt (ADMIN)
// ---------------------------------------------------------------------------

/**
 * POST /crawl/batch — tick nhiều category, crawl TUẦN TỰ. Backend chỉ tạo +
 * chạy category ĐẦU TIÊN ngay trong request này; các category sau tự chạy
 * nối tiếp ở nền (không cần request nào thêm). Theo dõi bằng getCrawlBatch().
 *
 * `pages` / `max_jobs`: bỏ trống cả hai -> backend tự áp số trang mặc định.
 * Ràng buộc: pages 1..20, max_jobs 1..1000 (backend trả 422 nếu vượt).
 * Chỉ gửi field có giá trị (schema extra="forbid", null cũng được nhưng gọn hơn).
 */
export async function triggerCrawlBatch(req: CrawlBatchRequest): Promise<CrawlBatchAccepted> {
  const body: CrawlBatchRequest = { source: req.source, categories: req.categories };
  if (req.pages != null) body.pages = req.pages;
  if (req.max_jobs != null) body.max_jobs = req.max_jobs;
  return callAuthed<CrawlBatchAccepted>("/crawl/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Xem (STAFF)
// ---------------------------------------------------------------------------

/**
 * GET /crawl/batch/{batch_id} — tiến độ 1 batch: `items` (run của các category
 * ĐÃ BẮT ĐẦU chạy), `total` (số category trong batch), `completed`.
 *
 * LƯU Ý: category chưa tới lượt CHƯA có record trong `items` (backend cố ý
 * không tạo sẵn run rỗng). Nơi hiển thị phải tự dựng placeholder "Đang chờ"
 * từ `categories` của batch, khớp theo TÊN category — dùng
 * buildBatchChecklist() bên dưới, đừng ghép theo vị trí mảng.
 */
export async function getCrawlBatch(batchId: string): Promise<CrawlBatchStatus> {
  return callAuthed<CrawlBatchStatus>(`/crawl/batch/${encodeURIComponent(batchId)}`);
}

export interface CrawlListFilters {
  source?: string;
  status?: string;
  triggered_by?: string;
  limit?: number;
  offset?: number;
}

function listQuery(filters: CrawlListFilters): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 20));
  params.set("offset", String(filters.offset ?? 0));
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.triggered_by) params.set("triggered_by", filters.triggered_by);
  return params.toString();
}

/** GET /crawl — lịch sử run crawl, phân trang ở backend (bảng tab Lịch sử). */
export async function listCrawlRuns(filters: CrawlListFilters = {}): Promise<PaginatedCrawlRuns> {
  return callAuthed<PaginatedCrawlRuns>(`/crawl?${listQuery(filters)}`);
}

/** GET /crawl/batch — lịch sử batch (bản gọn). `status`: running | done | error. */
export async function listCrawlBatches(
  filters: CrawlListFilters = {},
): Promise<PaginatedCrawlBatches> {
  return callAuthed<PaginatedCrawlBatches>(`/crawl/batch?${listQuery(filters)}`);
}

/** GET /crawl/{run_id} — trạng thái 1 run (polling bằng useSWR). */
export async function getCrawlRun(runId: string): Promise<CrawlRun> {
  return callAuthed<CrawlRun>(`/crawl/${encodeURIComponent(runId)}`);
}

/**
 * GET /crawl/{run_id}/logs — log live. Poll TĂNG DẦN: truyền `after_id` =
 * `last_id` của lần trước, chỉ nhận dòng mới. `limit` tối đa theo backend.
 */
export async function getCrawlLogs(
  runId: string,
  opts: { afterId?: number; limit?: number } = {},
): Promise<CrawlLogs> {
  const params = new URLSearchParams();
  params.set("after_id", String(opts.afterId ?? 0));
  if (opts.limit != null) params.set("limit", String(opts.limit));
  return callAuthed<CrawlLogs>(`/crawl/${encodeURIComponent(runId)}/logs?${params.toString()}`);
}

/**
 * GET /crawl/latest-log-run — run crawl GẦN NHẤT (bất kể status) để khung
 * "Log live" có run_id ngay lúc mở trang. Trả `null` khi CHƯA TỪNG crawl lần
 * nào — hợp lệ, KHÔNG phải lỗi; đừng tự suy run_id từ danh sách lịch sử.
 */
export async function getLatestCrawlLogRun(): Promise<CrawlRun | null> {
  return (await callAuthed<CrawlRun | null>("/crawl/latest-log-run")) ?? null;
}
