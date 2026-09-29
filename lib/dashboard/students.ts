// lib/dashboard/students.ts
// Phần tính/định dạng THUẦN (không fetch, không React) của tab "Gợi ý học
// viên" ở /dashboard — tương đương phần hiển thị avg_min_fmt/avg_max_fmt của
// blueprints/dashboard.py::_salary_ranges_by_industry_level() và khối
// {% if r.avg_min_fmt and r.avg_max_fmt %} ở dashboard.html. Tách khỏi
// component để test được bằng dữ liệu giả.
//
// KHÔNG có logic lọc/đếm ngày ở đây: 4 khối (push/stale/top skills/lương)
// backend đã tính sẵn bằng SQL theo giờ VN — xem lib/api/dashboard.ts.

import type { SalaryRangeRow } from "@/lib/api/dashboard";

const VND_FORMAT = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Số tiền VNĐ dạng "10.000.000" (làm tròn về đồng, dấu chấm ngăn nghìn). */
export function formatVnd(value: number): string {
  return VND_FORMAT.format(Math.round(value));
}

/**
 * Ô "Lương TB" của bảng khoảng lương — khớp 4 nhánh của Flask:
 *   có cả min và max -> "min – max"; chỉ min -> "từ min"; chỉ max -> "đến
 *   max"; không có gì -> "—". Giá trị 0/null coi là không có (backend đã
 *   lọc > 0 nên 0 không xảy ra, giữ điều kiện truthy như Flask cho chắc).
 */
export function formatSalaryRange(row: Pick<SalaryRangeRow, "avg_min" | "avg_max">): string {
  const lo = row.avg_min ? formatVnd(row.avg_min) : null;
  const hi = row.avg_max ? formatVnd(row.avg_max) : null;
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `từ ${lo}`;
  if (hi) return `đến ${hi}`;
  return "—";
}
