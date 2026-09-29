// lib/dashboard/overview.ts
// Phần tính toán THUẦN (không fetch, không React) của tab "Tổng quan" ở
// /dashboard — tương đương các phép đếm trong blueprints/dashboard.py::
// index() (jobs_by_industry/level/location, companies_by_city) và
// helpers.py::_jobs_by_month(). Tách riêng khỏi component để test được
// bằng dữ liệu giả và để 3 tab còn lại (làm ở các đợt sau) không phụ
// thuộc ngược vào file component của tab này.

import { toVNDate, todayVN } from "@/lib/date";

/** Nhãn hiển thị cho giá trị rỗng (job chưa có tỉnh, công ty chưa có
 *  thành phố) — Flask in ra hàng nhãn trống, ở đây gán nhãn tường minh. */
export const UNKNOWN_LABEL = "Chưa rõ";

export interface BarItem {
  label: string;
  value: number;
}

/** Đếm số phần tử theo khoá, giữ tên khoá rỗng dưới nhãn UNKNOWN_LABEL,
 *  sắp giảm dần theo số lượng (cùng số lượng thì theo tên, locale vi). Bản
 *  Flask giữ thứ tự xuất hiện trong danh sách job (vô nghĩa và đổi theo
 *  thứ tự API) — với danh sách có phân trang 20 dòng/trang thì đầu bảng
 *  phải là các mục lớn nhất. */
export function countByDesc<T>(items: T[], getKey: (item: T) => string | null | undefined): BarItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = (getKey(item) ?? "").trim() || UNKNOWN_LABEL;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "vi"));
}

/** Đếm theo danh sách khoá CỐ ĐỊNH (giữ nguyên thứ tự khoá, khoá không
 *  có phần tử nào vẫn hiện với 0) — khớp jobs_by_industry/jobs_by_level
 *  bên Flask, vốn lặp theo INDUSTRIES/get_level_codes(). Phần tử có khoá
 *  ngoài danh sách bị bỏ qua (giống Flask: tổng các thanh có thể < tổng
 *  job). */
export function countByFixedKeys<T>(
  items: T[],
  keys: readonly string[],
  getKey: (item: T) => string | null | undefined,
): BarItem[] {
  const counts = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const item of items) {
    const key = getKey(item);
    if (key != null && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

/** % độ rộng thanh, chặn trong [0, 100]; total = 0 -> 0 (không chia 0). */
export function percentOf(value: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

export interface MonthlyCounts {
  labels: string[];
  counts: number[];
}

/**
 * Đếm job theo tháng cho `monthsBack` tháng gần nhất (gồm tháng hiện tại),
 * theo giờ VN — khớp helpers.py::_jobs_by_month(). Nhãn "MM/YYYY", thứ tự
 * cũ -> mới.
 *
 * onlyPast=true: chỉ tính ngày TRƯỚC hôm nay (dùng cho cột "JD đã hết
 * hạn" — job có deadline rơi vào tương lai, kể cả trong tháng này, không
 * được tính là đã hết hạn).
 */
export function jobsByMonth<T>(
  jobs: T[],
  getDate: (job: T) => string | null | undefined,
  { monthsBack = 6, onlyPast = false }: { monthsBack?: number; onlyPast?: boolean } = {},
  today: string = todayVN(),
): MonthlyCounts {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));

  const keys: { key: string; label: string }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const mm = String(month).padStart(2, "0");
    keys.push({ key: `${year}-${mm}`, label: `${mm}/${year}` });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  keys.reverse();

  const counts = new Map<string, number>(keys.map((k) => [k.key, 0]));
  for (const job of jobs) {
    const d = toVNDate(getDate(job));
    if (d === null) continue;
    if (onlyPast && d >= today) continue;
    const key = d.slice(0, 7);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return { labels: keys.map((k) => k.label), counts: keys.map((k) => counts.get(k.key) ?? 0) };
}
