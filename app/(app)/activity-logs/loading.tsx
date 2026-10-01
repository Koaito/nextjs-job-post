// app/(app)/activity-logs/loading.tsx
// Khung chờ cho /activity-logs (Nhóm 3, Đợt 3.4, Phần 3/5) — thay cho "Đang
// tải…" của bản Flask. Next.js tự hiện file này trong lúc page.tsx (force-
// dynamic, gọi nhiều API) đang render; đổi tab/lọc/trang cũng hiện lại vì
// mỗi lần là 1 điều hướng thật. Bố cục bám page.tsx (tiêu đề, tab, thanh
// lọc, bảng) để không giật trang khi dữ liệu về.

import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

export default function ActivityLogsLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Đang tải lịch sử thao tác">
      <header className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </header>

      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-16" />
      </div>

      <Skeleton className="h-4 w-28" />

      <div className="space-y-2">
        {Array.from({ length: ROWS }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
