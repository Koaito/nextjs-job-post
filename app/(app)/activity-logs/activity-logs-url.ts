// app/(app)/activity-logs/activity-logs-url.ts
// Dựng URL /activity-logs từ view + bộ lọc — dùng chung cho tab-nav (giữ
// bộ lọc khi đổi tab, như Flask truyền **filters) và các link phân trang ở
// phần 3/5. Chỉ chứa giá trị ĐÃ validate (xem parseFilters ở page.tsx).

import type { AuditLogView } from "@/lib/api/audit-logs";

export interface ActivityLogFilterValues {
  /** KEY viết hoa backend (JOB/COMPANY/CONTACT/APPLICATION), "" = mọi đối tượng. */
  entityType: string;
  companyId: string;
  actorId: string;
}

export function hasActiveFilter(f: ActivityLogFilterValues): boolean {
  return Boolean(f.entityType || f.companyId || f.actorId);
}

export function buildActivityLogsHref(view: AuditLogView, f: ActivityLogFilterValues): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (f.entityType) params.set("entity_type", f.entityType);
  if (f.companyId) params.set("company_id", f.companyId);
  if (f.actorId) params.set("actor_id", f.actorId);
  return `/activity-logs?${params.toString()}`;
}
