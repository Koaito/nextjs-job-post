// app/(app)/activity-logs/activity-logs-tab-nav.tsx
// Tab-nav 2 view của /activity-logs ("Tự động" / "Thủ công") — tương đương
// <nav class="tab-nav" id="activityTabNav"> ở activity_logs.html (Flask).
// Nhóm 3, Đợt 3.4, Phần 1/5.
//
// Plan Nhóm 3: 2 tab chỉ là đổi query `?view=auto|manual` trên CÙNG 1 page
// (không phải 2 route riêng). Mỗi tab là <Link> điều hướng THẬT — không
// fetch-fragment-rồi-chèn-DOM như Flask, nên không cần cơ chế chống race
// (requestSeq) và vẫn dùng được khi JS lỗi/tắt. Server Component, tab
// active truyền qua prop (đọc từ searchParams ở page).
// Phần 2/5: giữ bộ lọc khi đổi tab (như Flask truyền **filters) — không
// giữ `page` (mỗi view có tổng số trang riêng).

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuditLogView } from "@/lib/api/audit-logs";
import { buildActivityLogsHref, type ActivityLogFilterValues } from "./activity-logs-url";

const TABS: { view: AuditLogView; label: string }[] = [
  { view: "auto", label: "Tự động" },
  { view: "manual", label: "Thủ công" },
];

export function ActivityLogsTabNav({ view, filters }: { view: AuditLogView; filters: ActivityLogFilterValues }) {
  return (
    <nav aria-label="Loại lịch sử thao tác" className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.view === view;
        return (
          <Link
            key={tab.view}
            href={buildActivityLogsHref(tab.view, filters)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
