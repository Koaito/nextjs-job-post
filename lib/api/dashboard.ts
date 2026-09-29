// lib/api/dashboard.ts
// Tương đương phần "insight" của crawler_client bên Flask, nhưng gọi thẳng 3
// endpoint mới của Scrap_JD (`/dashboard/insights/*`) thay vì kéo toàn bộ
// job/công ty/contact về rồi tự tính 8 khối bằng Python (Phần 5 mục 8 của
// plan — backend đã làm xong, tính bằng SQL). Mỗi endpoint ứng với đúng 1
// tab để chỉ tải tab đang mở.
//
// Cả 3 route yêu cầu ss_team trở lên (require_role("ss_team")) -> callAuthed,
// khác GET /stats chỉ cần X-API-Key.
//
// Field trả về theo tên backend (job_id/job_title/company_name...), KHÔNG
// theo tên Flask (id/position/company). Backend chỉ trả mã/số, nhãn tiếng
// Việt do frontend tự gắn.
//
// Phần 2/4 (Đợt 3.1): getStudentInsights(). 2 hàm còn lại (companies,
// monthly) thêm ở phần 3/4 và 4/4.

import { callAuthed } from "./client";
import type { components } from "./types";

export type StudentInsightsOut = components["schemas"]["StudentInsightsOut"];
export type PushJobRow = components["schemas"]["PushJobRow"];
export type StaleJobRow = components["schemas"]["StaleJobRow"];
export type SkillCount = components["schemas"]["SkillCount"];
export type SalaryRangeRow = components["schemas"]["SalaryRangeRow"];

/**
 * GET /dashboard/insights/students — tab "Gợi ý học viên":
 *   - jd_needing_push: job OPEN còn 7–14 ngày là hết hạn, chưa ai lưu/ứng
 *     tuyển (sắp deadline gần nhất trước; `days_left` backend tính sẵn).
 *   - jd_stale: job OPEN thu thập >= 30 ngày, chưa ai lưu/ứng tuyển (cũ nhất
 *     trước; `age_days` backend tính sẵn).
 *   - top_skills: tối đa 10 kỹ năng xuất hiện nhiều nhất ở job thu thập 30
 *     ngày gần đây.
 *   - salary_ranges: lương trung bình (VNĐ/tháng) theo ngành/level.
 *
 * Ngày/ngưỡng đều tính ở backend theo giờ Việt Nam (Phụ lục F) — frontend
 * KHÔNG tự tính lại "hôm nay" cho tab này. Đổi ngưỡng (7/14/30 ngày) là việc
 * của backend (tham số hàm db.dashboard), không phải của Next.js.
 */
export async function getStudentInsights(): Promise<StudentInsightsOut> {
  return callAuthed<StudentInsightsOut>("/dashboard/insights/students");
}
