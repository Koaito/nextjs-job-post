// app/(app)/activity-logs/activity-logs-filter-bar.tsx
// Thanh lọc của /activity-logs — tương đương <form class="filter-bar"> ở
// _activity_logs_body.html (Flask). Nhóm 3, Đợt 3.4, Phần 2/5.
//
// Là <form method="get"> THẬT: bấm "Lọc" là điều hướng /activity-logs?...
// (không fetch-fragment-rồi-chèn-DOM như Flask) nên dùng được khi JS lỗi
// và bộ lọc nằm sẵn trên URL (chia sẻ link được). Mỗi lần lọc không gửi
// `page` nên tự về trang 1. Server Component thuần; chỉ ô công ty là
// Client Component (CompanyFilterCombobox).
//
// Plan Nhóm 3: `value` của dropdown đối tượng là KEY backend viết hoa (JOB,
// COMPANY...), nhãn tiếng Việt chỉ để hiển thị — gửi nhãn sẽ bị 400.

import Link from "next/link";
import { AUDIT_ENTITY_LABELS } from "@/lib/constants";
import type { AuditLogView } from "@/lib/api/audit-logs";
import { CompanyFilterCombobox } from "./company-filter-combobox";
import { hasActiveFilter, type ActivityLogFilterValues } from "./activity-logs-url";

export interface StaffOption {
  id: string;
  name: string;
}

export function ActivityLogsFilterBar({
  view,
  filters,
  companyName,
  staff,
}: {
  view: AuditLogView;
  filters: ActivityLogFilterValues;
  /** Tên công ty đang lọc (rỗng nếu không lọc hoặc không tải được). */
  companyName: string;
  staff: StaffOption[];
}) {
  return (
    <form method="get" action="/activity-logs" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="view" value={view} />

      <select
        name="entity_type"
        defaultValue={filters.entityType}
        aria-label="Đối tượng"
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">Mọi đối tượng</option>
        {Object.entries(AUDIT_ENTITY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <CompanyFilterCombobox initialId={filters.companyId} initialName={companyName} />

      <select
        name="actor_id"
        defaultValue={filters.actorId}
        aria-label="Người thực hiện"
        className="max-w-[220px] rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="">Mọi người thực hiện</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <button type="submit" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        Lọc
      </button>
      {hasActiveFilter(filters) && (
        <Link href={`/activity-logs?view=${view}`} className="rounded-md px-3 py-2 text-sm underline">
          Xóa lọc
        </Link>
      )}
    </form>
  );
}
