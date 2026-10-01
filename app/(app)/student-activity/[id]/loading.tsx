// app/(app)/student-activity/[id]/loading.tsx
// Khung chờ cho /student-activity/[id] (Nhóm 3, Đợt 3.3, Phần 3/4) — page.tsx
// là force-dynamic, tải danh sách user rồi mới tải 2 danh sách ứng tuyển/đã
// lưu nên có độ trễ rõ. Bố cục bám page.tsx: ô thống kê 3 cột + 2 lưới card.

import { Skeleton } from "@/components/ui/skeleton";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";

function CardGridSkeleton() {
  return (
    <div className={JOB_GRID_CLASS}>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-[var(--radius)]" />
      ))}
    </div>
  );
}

export default function StudentActivityDetailLoading() {
  return (
    <div className="space-y-6">
      <span className="inline-block text-sm text-muted-foreground">← Hoạt động học viên</span>

      <header className="space-y-2" aria-hidden="true">
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị / Hoạt động học viên</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </header>

      <div
        className="space-y-6"
        role="status"
        aria-busy="true"
        aria-label="Đang tải hoạt động học viên"
      >
        <div className="grid grid-cols-2 gap-4 rounded-md border p-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>

        {Array.from({ length: 2 }, (_, i) => (
          <section key={i} className="space-y-3">
            <Skeleton className="h-6 w-44" />
            <CardGridSkeleton />
          </section>
        ))}
      </div>
    </div>
  );
}
