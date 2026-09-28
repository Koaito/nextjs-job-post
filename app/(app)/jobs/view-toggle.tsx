// app/(app)/jobs/view-toggle.tsx
// Round 6 (nửa 2/2) — tương đương thanh gạt "Chế độ xem" trong
// index.html (Flask, khối `.view-toggle`). Server Component thuần —
// 2 <Link> điều hướng THẬT, không phải toggle state client giữ nguyên
// vị trí (plan Nhóm 1, dòng 971): đổi chế độ luôn là 1 lượt điều
// hướng mới, tự động về đầu danh sách (không có `page`/`cursor` nào
// trong href), và giữ nguyên mọi filter khác đang áp dụng qua
// `currentParams` (đã bỏ sẵn `page`/`view` ở nơi gọi, y hệt
// `pagination_filters` bên Flask).

import Link from "next/link";

export function ViewToggle({
  currentParams,
  view,
}: {
  /** Filter hiện tại (q/industry/level/location/status có giá trị) —
   *  KHÔNG chứa "page" hay "view". */
  currentParams: URLSearchParams;
  view: "page" | "infinite";
}) {
  const baseQs = currentParams.toString();
  const pageHref = baseQs ? `/jobs?${baseQs}` : "/jobs";

  const infiniteParams = new URLSearchParams(currentParams);
  infiniteParams.set("view", "infinite");
  const infiniteHref = `/jobs?${infiniteParams.toString()}`;

  // `.view-toggle-btn` (10-pagination-responsive.css): 13.5px/600, padding
  // 8px 14px, viền --border, nền trắng; nút đầu bo trái, nút cuối bo phải
  // và bỏ viền trái; đang chọn = nền --ink, chữ trắng. Bản trước dùng
  // pill bo tròn nền cam nên lệch hẳn.
  const base =
    "border px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap hover:border-foreground";
  const activeClass = "border-foreground bg-foreground text-card";
  const inactiveClass = "border-border bg-card text-foreground";

  return (
    <div className="mt-1 mb-[18px] inline-flex items-center gap-2.5">
      <span className="text-[13.5px] whitespace-nowrap text-[var(--brand-ink-soft)]">
        Chế độ xem:
      </span>
      <Link
        href={pageHref}
        className={`${base} rounded-l-lg ${view !== "infinite" ? activeClass : inactiveClass}`}
      >
        Phân trang
      </Link>
      <Link
        href={infiniteHref}
        className={`${base} rounded-r-lg border-l-0 ${view === "infinite" ? activeClass : inactiveClass}`}
      >
        Cuộn liên tục
      </Link>
    </div>
  );
}
