// app/(app)/crawl/history-pager.tsx
// Phân trang của MỘT bảng lịch sử: Trước/Sau là <Link> (giữ nguyên query của bảng kia), "Trang x / y".
// Server Component thuần, dùng được khi JS tắt. Tự ẩn khi chỉ có một trang.

import Link from "next/link";

const BTN = "inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium";
const BTN_OFF = `${BTN} pointer-events-none text-muted-foreground opacity-60`;

export function HistoryPager({
  label,
  page,
  totalPages,
  hrefFor,
}: {
  /** Tên bảng cho aria-label, để trình đọc màn hình phân biệt hai bộ phân trang. */
  label: string;
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={`Phân trang ${label}`} className="mt-3 flex items-center justify-end gap-2 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${BTN} hover:border-foreground`}>
          ‹ Trước
        </Link>
      ) : (
        <span aria-disabled="true" className={BTN_OFF}>
          ‹ Trước
        </span>
      )}
      <span className="min-w-20 text-center font-mono text-muted-foreground" aria-live="polite">
        Trang {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={`${BTN} hover:border-foreground`}>
          Sau ›
        </Link>
      ) : (
        <span aria-disabled="true" className={BTN_OFF}>
          Sau ›
        </span>
      )}
    </nav>
  );
}
