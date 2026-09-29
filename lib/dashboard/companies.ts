// lib/dashboard/companies.ts
// Phần THUẦN (không fetch, không React) của tab "Doanh nghiệp" ở /dashboard.
// Dùng chung giữa page.tsx (Server Component, đọc searchParams) và
// followup-days-select.tsx (Client Component) nên không import gì từ
// React/Next.

/** Whitelist cố định cho ô "Im lặng từ" (Contact cần follow-up) — khớp
 *  FOLLOWUP_DAYS_OPTIONS ở blueprints/dashboard.py (Flask) và api/routers/
 *  dashboard.py (Scrap_JD). Cố ý KHÔNG cho nhập số tự do (chặn 0, âm, quá
 *  lớn làm bảng rỗng/vô nghĩa). */
export const FOLLOWUP_DAYS_OPTIONS = [7, 14, 30] as const;
export type FollowupDays = (typeof FOLLOWUP_DAYS_OPTIONS)[number];
export const FOLLOWUP_DAYS_DEFAULT: FollowupDays = 14;

/** `?followup_days=` -> số ngày hợp lệ. Thiếu/lạ/không phải số nguyên sạch
 *  ("14abc", "1e1", "14.0", "") -> mặc định 14 thay vì lỗi hoặc chấp nhận
 *  số bất kỳ (khớp _followup_days_arg() của Flask; mảng lặp `?a=1&a=2` lấy
 *  giá trị đầu). Kiểm tra bằng regex chứ không dùng Number()/parseInt() vì
 *  cả hai đều nuốt phần đuôi rác ("14abc" -> 14). */
export function parseFollowupDays(raw: string | string[] | undefined): FollowupDays {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return FOLLOWUP_DAYS_DEFAULT;
  const n = Number(value.trim());
  return (FOLLOWUP_DAYS_OPTIONS as readonly number[]).includes(n) ? (n as FollowupDays) : FOLLOWUP_DAYS_DEFAULT;
}

/** Mã `reason` backend trả cho "Công ty tiềm năng cao thiếu contact" -> nhãn
 *  tiếng Việt (backend chỉ trả mã, Flask trả sẵn câu). */
export const NO_CONTACT_REASON_LABELS: Record<string, string> = {
  no_contact: "Chưa có contact nào",
  contact_gone_cold: "Contact đã nguội",
  never_contacted: "Có contact nhưng chưa từng liên hệ",
};
