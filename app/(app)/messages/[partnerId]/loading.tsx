// app/(app)/messages/[partnerId]/loading.tsx
// Khung chờ cho /messages/[partnerId] (Nhóm 4, Phần 2/3) — page.tsx là
// force-dynamic và gọi 3 API nối tiếp/song song. Khai báo riêng vì
// messages/loading.tsx (hình dạng danh sách hội thoại) sẽ bọc route này nếu
// thiếu file này. Link "← Tin nhắn" là chữ tĩnh nên hiện thật.

import { Skeleton } from "@/components/ui/skeleton";

export default function MessageThreadLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Đang tải hội thoại">
      <header>
        <span className="text-sm text-muted-foreground">← Tin nhắn</span>
        <Skeleton className="mt-2 h-9 w-64 max-w-full" />
      </header>

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <div className="flex h-[56vh] min-h-[280px] flex-col gap-2.5 p-[22px]">
          <Skeleton className="h-10 w-[45%] self-start rounded-[14px]" />
          <Skeleton className="h-14 w-[55%] self-end rounded-[14px]" />
          <Skeleton className="h-10 w-[35%] self-start rounded-[14px]" />
          <Skeleton className="h-10 w-[40%] self-end rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}
