"use client";
// app/(app)/dashboard/dashboard-tab-bar.tsx
// Thanh 4 tab của /dashboard — tương đương <div id="dashboardTabBar"> +
// script activate() ở dashboard.html (Flask).
//
// Khác Flask ở CÁCH đổi tab (plan Nhóm 3): bản Flask tính đủ dữ liệu cho cả
// 4 tab ngay lượt tải đầu rồi chỉ ẩn/hiện bằng JS. Ở đây mỗi tab là 1 phần
// riêng của Server Component tính theo yêu cầu — bấm tab = router.replace()
// tới `?tab=<id>`, server chỉ tải dữ liệu của ĐÚNG tab đó.
//   - replace (KHÔNG push): đổi tab không tạo thêm history entry, nút
//     Back của trình duyệt không lùi qua từng tab đã xem (khớp
//     history.replaceState bên Flask).
//   - `?tab=` được server đọc khi render trang (page.tsx) nên link chia sẻ
//     mở đúng tab người gửi đang xem.
//   - scroll: false để không nhảy lên đầu trang khi đổi tab.
//   - `?followup_days=` (ô chọn của tab Doanh nghiệp) được GIỮ khi đổi tab,
//     như Flask (url.searchParams.set("tab") chỉ đổi đúng 1 tham số) — chọn
//     30 ngày rồi sang tab khác và quay lại vẫn còn 30. Chỉ giữ giá trị đã
//     qua whitelist, không chép nguyên query string.
//   - useOptimistic + transition: tab vừa bấm sáng ngay, không đợi server
//     trả dữ liệu tab mới (lúc đó nội dung cũ vẫn hiện, aria-busy báo bận).

import { useOptimistic, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { FOLLOWUP_DAYS_DEFAULT, parseFollowupDays } from "@/lib/dashboard/companies";
import { DASHBOARD_TABS, type DashboardTabId } from "./dashboard-tabs";

export function DashboardTabBar({ active }: { active: DashboardTabId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);

  function select(id: DashboardTabId) {
    if (id === optimisticActive) return;
    startTransition(() => {
      setOptimisticActive(id);
      const rawFollowup = searchParams.get("followup_days");
      const followup = rawFollowup === null ? null : parseFollowupDays(rawFollowup);
      // Giá trị lạ đã bị parse về mặc định -> khỏi ghi lại vào URL.
      const suffix = followup !== null && followup !== FOLLOWUP_DAYS_DEFAULT ? `&followup_days=${followup}` : "";
      router.replace(`/dashboard?tab=${id}${suffix}`, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Các phần của dashboard"
      aria-busy={isPending}
      className="flex flex-wrap gap-1 rounded-[var(--radius)] border border-border bg-card p-[5px]"
    >
      {DASHBOARD_TABS.map((tab) => {
        const selected = tab.id === optimisticActive;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={!tab.ready}
            title={tab.ready ? undefined : "Sắp có"}
            onClick={() => select(tab.id)}
            className={cn(
              "rounded-[9px] px-4 py-[9px] text-[13.5px] font-semibold transition-colors",
              selected
                ? "bg-[var(--brand-accent-soft)] text-primary"
                : "text-[var(--brand-ink-soft)] hover:text-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-[var(--brand-ink-soft)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
