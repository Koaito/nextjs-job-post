// lib/dashboard/monthly.ts
// Phần định dạng THUẦN (không fetch, không React) của tab "Báo cáo tháng" ở
// /dashboard — tương đương phần {{ '+' if pct > 0 }}{{ pct }}% và lớp
// pct-up/pct-down/pct-flat ở dashboard.html (Flask). Tách khỏi component để
// test được bằng dữ liệu giả.
//
// KHÔNG tính % ở đây: backend Scrap_JD đã trả sẵn `*_pct` (int | null) —
// xem lib/api/dashboard.ts::getMonthlyInsights.

export type PctTone = "up" | "down" | "flat";

/** Màu huy hiệu: >0 tăng, <0 giảm, đúng 0 đi ngang (khớp 3 nhánh của Flask). */
export function pctTone(pct: number): PctTone {
  if (pct > 0) return "up";
  if (pct < 0) return "down";
  return "flat";
}

/** Chữ huy hiệu: "+12%", "-5%", "0%". Số dương mới có dấu "+" như Flask. */
export function formatPct(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/**
 * "YYYY-MM-DD" (ngày đầu tháng backend trả, đã theo giờ VN) -> "9/2026".
 * Cắt chuỗi thay vì `new Date(...)` để KHÔNG phụ thuộc múi giờ máy chạy
 * (Vercel luôn UTC) — chuỗi không đúng dạng thì trả nguyên chuỗi, không ném lỗi.
 */
export function formatMonthYear(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[2])}/${m[1]}`;
}
