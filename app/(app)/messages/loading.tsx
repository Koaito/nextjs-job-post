// app/(app)/messages/loading.tsx
// Khung chờ cho /messages (Nhóm 4, Phần 1/3) — page.tsx là force-dynamic và
// gọi 1-2 API nên cần khung chờ. Chữ tĩnh (eyebrow, tiêu đề) hiện thật.
// LƯU Ý: file này bọc cả các route con (/messages/new, /messages/[partnerId])
// nếu chúng KHÔNG có loading.tsx riêng — route con nào cũng phải tự có.

import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 5;

export default function MessagesLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Đang tải tin nhắn">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Career Hub / Nhắn tin</span>
          <h1 className="font-heading text-3xl font-semibold">Tin nhắn</h1>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </header>

      <div className="flex flex-col gap-2">
        {Array.from({ length: ROWS }, (_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  );
}
