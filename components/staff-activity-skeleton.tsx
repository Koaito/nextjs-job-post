// components/staff-activity-skeleton.tsx
// Khung chờ cho phần thân của components/staff-activity-view.tsx (khối thống
// kê + 4 danh sách), dùng chung cho loading.tsx của /staff-activity/[id] và
// /profile/activity — cùng lý do StaffActivityView được tách ra dùng chung:
// 2 trang cùng bố cục thì khung chờ cũng không viết trùng.
// Bố cục bám StaffActivityView (ô thống kê 4 cột, lưới card job, 3 bảng) để
// không giật trang khi dữ liệu về. Server Component thuần, không cần "use client".

import { Skeleton } from "@/components/ui/skeleton";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function StaffActivitySkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Đang tải hoạt động">
      <div className="space-y-3 rounded-md border p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <Skeleton className="h-6 w-44" />
        <div className={JOB_GRID_CLASS}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-[var(--radius)]" />
          ))}
        </div>
      </section>

      {Array.from({ length: 3 }, (_, i) => (
        <section key={i} className="space-y-3">
          <Skeleton className="h-6 w-52" />
          <TableSkeleton />
        </section>
      ))}
    </div>
  );
}
