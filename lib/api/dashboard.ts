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
// Phần 2/4 (Đợt 3.1): getStudentInsights(). Phần 3/4: getCompanyInsights().
// Phần 4/4: getMonthlyInsights().

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

export type CompanyInsightsOut = components["schemas"]["CompanyInsightsOut"];
export type HighPotentialCompanyRow = components["schemas"]["HighPotentialCompanyRow"];
export type FollowupContactRow = components["schemas"]["FollowupContactRow"];
export type ExpandingCompanyRow = components["schemas"]["ExpandingCompanyRow"];
export type QuietCompanyRow = components["schemas"]["QuietCompanyRow"];

/**
 * GET /dashboard/insights/companies?followup_days=N — tab "Doanh nghiệp":
 *   - companies_no_contact: công ty tiềm năng CAO chưa có contact / contact
 *     đã nguội >= 60 ngày (`reason` là MÃ, nhãn tiếng Việt gắn ở frontend).
 *   - contacts_needing_followup: contact chưa "Đang hợp tác" im lặng >=
 *     followup_days (backend trả `quiet_days`/`never_contacted` sẵn).
 *   - companies_expanding: >= 2 job mới trong 30 ngày (kèm tối đa 5 tên job).
 *   - companies_quiet: job gần nhất cách đây > 75 ngày.
 *
 * `followupDays` PHẢI nằm trong whitelist 7|14|30 — backend trả 400 với giá
 * trị lạ (khác Flask lặng lẽ rơi về 14). Nơi gọi validate trước bằng
 * parseFollowupDays() (lib/dashboard/companies.ts), KHÔNG truyền thẳng
 * query string người dùng gõ tay.
 */
export async function getCompanyInsights(followupDays: number): Promise<CompanyInsightsOut> {
  const qs = new URLSearchParams({ followup_days: String(followupDays) });
  return callAuthed<CompanyInsightsOut>(`/dashboard/insights/companies?${qs}`);
}

export type MonthlyInsightsOut = components["schemas"]["MonthlyInsightsOut"];
export type TopIndustryRow = components["schemas"]["TopIndustryRow"];
export type TopCompanyRow = components["schemas"]["TopCompanyRow"];

/**
 * GET /dashboard/insights/monthly — tab "Báo cáo tháng":
 *   - jobs_new / companies_new: số job/công ty MỚI thu thập trong tháng này.
 *   - jobs_expired: job có hạn nộp rơi trong tháng này VÀ đã qua.
 *   - top_industries (tối đa 3) / top_companies (tối đa 5): nhiều job nhất
 *     tháng này; `pct_change` của ngành so với tháng trước.
 *   - applications_this_month / saved_jobs_this_month: lượt ứng tuyển/lưu job.
 *   - `*_pct`: % chênh lệch so với tháng trước, BACKEND ĐÃ TÍNH SẴN (plan ghi
 *     frontend tự tính từ /stats/engagement — không còn đúng). `null` khi
 *     tháng trước = 0 (không chia được) -> nơi hiển thị phải ẩn huy hiệu %,
 *     KHÔNG tự coi là 0.
 *
 * "Tháng" theo lịch giờ Việt Nam do backend tính (`this_month_start`/
 * `last_month_start`, gồm cả phần engagement — lỗi date_trunc UTC ở Phụ lục F
 * đã được sửa ở get_monthly_engagement_stats). Frontend KHÔNG tự tính lại ranh
 * giới tháng cho tab này.
 */
export async function getMonthlyInsights(): Promise<MonthlyInsightsOut> {
  return callAuthed<MonthlyInsightsOut>("/dashboard/insights/monthly");
}
