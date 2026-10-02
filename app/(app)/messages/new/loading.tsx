// app/(app)/messages/new/loading.tsx
// Khung chờ cho /messages/new — bấm "Tìm" là 1 lần điều hướng thật (form
// GET), nên cần khung chờ riêng. Khai báo riêng vì messages/loading.tsx
// (hình dạng danh sách hội thoại) sẽ bọc route này nếu thiếu file này.

import { Skeleton } from "@/components/ui/skeleton";

export default function NewMessageLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Đang tải">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Career Hub / Nhắn tin</span>
          <h1 className="font-heading text-3xl font-semibold">Nhắn tin mới</h1>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-44" />
      </header>

      <Skeleton className="h-10 w-full max-w-xl" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
