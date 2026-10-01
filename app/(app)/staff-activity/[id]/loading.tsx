// app/(app)/staff-activity/[id]/loading.tsx
// Khung chờ cho /staff-activity/[id] (Nhóm 3, Đợt 3.3) — page.tsx là
// force-dynamic và gọi 5 API song song, nên không có loading.tsx thì bấm vào
// 1 thành viên là trang đứng im tới khi xong hết. Link "←" và nhãn eyebrow là
// chữ tĩnh nên hiện thật; tên + email thì chưa biết nên để skeleton.

import { Skeleton } from "@/components/ui/skeleton";
import { StaffActivitySkeleton } from "@/components/staff-activity-skeleton";

export default function StaffActivityDetailLoading() {
  return (
    <div className="space-y-6">
      <span className="inline-block text-sm text-muted-foreground">← Hoạt động team SS</span>

      <header className="space-y-2" aria-hidden="true">
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị / Hoạt động team SS</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-72" />
      </header>

      <StaffActivitySkeleton />
    </div>
  );
}
