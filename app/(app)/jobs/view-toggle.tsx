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

  const activeClass = "bg-primary text-primary-foreground";
  const inactiveClass = "border text-muted-foreground hover:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Chế độ xem:</span>
      <Link
        href={pageHref}
        className={`rounded-full px-3 py-1 ${view !== "infinite" ? activeClass : inactiveClass}`}
      >
        Phân trang
      </Link>
      <Link
        href={infiniteHref}
        className={`rounded-full px-3 py-1 ${view === "infinite" ? activeClass : inactiveClass}`}
      >
        Cuộn liên tục
      </Link>
    </div>
  );
}
