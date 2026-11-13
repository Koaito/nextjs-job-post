// lib/api/maintenance.ts
// Nhóm 6, tab "Bảo trì" của /crawl. Tương đương crawler_client/maintenance.py.
//
// QUYỀN (khớp scrapjd/api/routers/maintenance.py):
//   - CHẠY job (POST /maintenance/{job_type}) -> require_admin -> nơi gọi requireAdmin()
//   - XEM (mọi GET)                            -> ss_team       -> nơi gọi requireStaff()
// File này không tự check quyền (cùng quy ước các module lib/api/ khác).
//
// RATE LIMIT: POST /maintenance/{job_type} giới hạn 10 lượt/giờ theo user ->
// 429 (không có error_code). 409 = job_type này đang chạy dở.

import { callAuthed } from "./client";
import {
  MAINTENANCE_DRY_RUN_JOB_TYPE,
  MAINTENANCE_JOB_TYPES,
  maintenanceRequiresLimit,
  maintenanceSupportsDryRun,
  narrowMaintenanceRun,
  type AnyMaintenanceRun,
  type MaintenanceAccepted,
  type MaintenanceJobType,
  type MaintenanceLogs,
  type MaintenanceRunRequest,
  type MaintenanceStatus,
  type PaginatedMaintenanceRuns,
} from "@/lib/data-ops/maintenance";

// Hằng số, quy tắc form, type `stats` theo job và hàm thuần nằm ở
// lib/data-ops/maintenance.ts để Client Component import được; re-export
// type ở đây cho nơi gọi phía server tiện dùng.
export type {
  AnyMaintenanceRun,
  MaintenanceAccepted,
  MaintenanceJobType,
  MaintenanceLogLine,
  MaintenanceLogs,
  MaintenanceRun,
  MaintenanceRunRequest,
  MaintenanceStatsByJobType,
  MaintenanceStatus,
  PaginatedMaintenanceRuns,
} from "@/lib/data-ops/maintenance";

// ---------------------------------------------------------------------------
// Kích hoạt (ADMIN)
// ---------------------------------------------------------------------------

/**
 * POST /maintenance/{job_type}. Kiểm tra trước ở client để báo lỗi sớm (backend
 * vẫn là nơi quyết định, trả 400):
 *   - job bắt buộc limit mà thiếu -> ném Error (không gọi mạng);
 *   - dry_run/check_deadline_only cho job khác check_expired_jobs -> ném Error.
 * Chỉ gửi field có giá trị (schema extra="forbid"; gửi `dry_run: false` cho
 * job khác cũng bị 400 vì backend kiểm tra `is not None`, nên TUYỆT ĐỐI
 * không gửi false "cho đủ field").
 */
export async function triggerMaintenanceRun(
  jobType: MaintenanceJobType,
  req: MaintenanceRunRequest = {},
): Promise<MaintenanceAccepted> {
  if (maintenanceRequiresLimit(jobType) && req.limit == null) {
    throw new Error(`Job ${jobType} tốn phí thật: bắt buộc nhập giới hạn (limit).`);
  }
  const supportsDry = maintenanceSupportsDryRun(jobType);
  if (!supportsDry && (req.dry_run != null || req.check_deadline_only != null)) {
    throw new Error(`dry_run/check_deadline_only chỉ áp dụng cho ${MAINTENANCE_DRY_RUN_JOB_TYPE}.`);
  }

  const body: MaintenanceRunRequest = {};
  if (req.limit != null) body.limit = req.limit;
  if (supportsDry) {
    if (req.dry_run != null) body.dry_run = req.dry_run;
    if (req.check_deadline_only != null) body.check_deadline_only = req.check_deadline_only;
  }
  return callAuthed<MaintenanceAccepted>(`/maintenance/${encodeURIComponent(jobType)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Xem (STAFF)
// ---------------------------------------------------------------------------

export interface MaintenanceListFilters {
  job_type?: string;
  status?: string;
  triggered_by?: string;
  limit?: number;
  offset?: number;
}

/** GET /maintenance — lịch sử bảo trì, phân trang ở backend (bảng tab Lịch sử). */
export async function listMaintenanceRuns(
  filters: MaintenanceListFilters = {},
): Promise<PaginatedMaintenanceRuns> {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 20));
  params.set("offset", String(filters.offset ?? 0));
  if (filters.job_type) params.set("job_type", filters.job_type);
  if (filters.status) params.set("status", filters.status);
  if (filters.triggered_by) params.set("triggered_by", filters.triggered_by);
  return callAuthed<PaginatedMaintenanceRuns>(`/maintenance?${params.toString()}`);
}

/** GET /maintenance/{run_id} — trạng thái 1 run (polling bằng useSWR). */
export async function getMaintenanceRun(runId: string): Promise<MaintenanceStatus> {
  return callAuthed<MaintenanceStatus>(`/maintenance/${encodeURIComponent(runId)}`);
}

/** GET /maintenance/{run_id}/logs — log live của 1 run; poll tăng dần bằng `after_id`. */
export async function getMaintenanceLogs(
  runId: string,
  opts: { afterId?: number; limit?: number } = {},
): Promise<MaintenanceLogs> {
  const params = new URLSearchParams();
  params.set("after_id", String(opts.afterId ?? 0));
  if (opts.limit != null) params.set("limit", String(opts.limit));
  return callAuthed<MaintenanceLogs>(
    `/maintenance/${encodeURIComponent(runId)}/logs?${params.toString()}`,
  );
}

/**
 * GET /maintenance/latest-log-runs — run GẦN NHẤT của MỖI job_type trong 1 lần
 * gọi (không phải gọi riêng từng job_type): { [job_type]: run | null }, null
 * khi job đó chưa từng chạy — hợp lệ, không phải lỗi. Để mỗi card có run_id
 * hiện log ngay lúc mở trang.
 *
 * OpenAPI chỉ khai `{[key: string]: unknown}` nên ánh xạ lại ở đây: khoá lạ
 * (job_type backend mới thêm) bị bỏ qua, job thiếu khoá -> null.
 */
export async function getLatestMaintenanceRuns(): Promise<
  Record<MaintenanceJobType, AnyMaintenanceRun | null>
> {
  const raw = await callAuthed<Record<string, MaintenanceStatus | null>>(
    "/maintenance/latest-log-runs",
  );
  const out = {} as Record<MaintenanceJobType, AnyMaintenanceRun | null>;
  for (const jobType of MAINTENANCE_JOB_TYPES) {
    const run = raw?.[jobType];
    out[jobType] = run ? narrowMaintenanceRun(run) : null;
  }
  return out;
}

/** 1 phần tử của lời gọi gộp logs-batch: run nào + đã đọc tới log id nào. */
export interface MaintenanceLogCursor {
  runId: string;
  afterId: number;
}

/**
 * GET /maintenance/logs-batch — GỘP log của nhiều run (5 khung "Log live" ở
 * tab Bảo trì) thành 1 request thay vì 5 request poll riêng. Backend nhận
 * `run_ids`/`after_ids` dạng chuỗi phân cách dấu phẩy, khớp CHẶT theo VỊ
 * TRÍ — nên build từ MỘT mảng cursor (hai chuỗi sinh ra cùng lúc, cùng thứ
 * tự, không thể lệch nhau), và KHÔNG dùng `run_ids=a&run_ids=b`.
 *
 * Trả { [run_id]: { last_id, items } } — chỉ những run_id đã gửi. Mảng rỗng
 * -> trả {} ngay, không gọi mạng (backend bắt buộc run_ids không rỗng).
 */
export async function getMaintenanceLogsBatch(
  cursors: MaintenanceLogCursor[],
  limit?: number,
): Promise<Record<string, MaintenanceLogs>> {
  if (cursors.length === 0) return {};
  const params = new URLSearchParams();
  params.set("run_ids", cursors.map((c) => c.runId).join(","));
  params.set("after_ids", cursors.map((c) => String(Math.max(0, Math.trunc(c.afterId)))).join(","));
  if (limit != null) params.set("limit", String(limit));
  return callAuthed<Record<string, MaintenanceLogs>>(`/maintenance/logs-batch?${params.toString()}`);
}
