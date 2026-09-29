// lib/api/stats.ts
// Tương đương crawler_client/stats.py bên Flask. Cả GET /stats lẫn (sau
// này) GET /stats/engagement chỉ cần X-API-Key, KHÔNG cần access token ->
// callPublic, giống get_stats() bên Flask ("không cần access_token").
// Trang dùng đã tự chặn staff bằng requireStaff() — route backend không
// cần thêm lớp quyền.

import { callPublic } from "./client";
import type { components } from "./types";

export type StatsOut = components["schemas"]["StatsOut"];

/**
 * GET /stats — số liệu tổng quan cho tab "Tổng quan" của /dashboard:
 * total_applications, total_saved_jobs, total_students, jobs_by_status.
 *
 * LƯU Ý jobs_by_status: khoá là mã backend thô ("OPEN"/"CLOSED"), KHÔNG
 * phải nhãn tiếng Việt. Template dashboard.html bên Flask đọc
 * `jobs_by_status.get('Đang tuyển', 0)` — luôn ra 0 (khoá không bao giờ
 * khớp) và thẻ "Job theo trạng thái" in nguyên "OPEN"/"CLOSED". Bản này
 * đọc đúng khoá `OPEN` và đổi nhãn qua JOB_STATUS_LABELS (lib/constants).
 */
export async function getStats(): Promise<StatsOut> {
  return callPublic<StatsOut>("/stats");
}
