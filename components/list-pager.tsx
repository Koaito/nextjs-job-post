"use client";
// components/list-pager.tsx
// Thanh phân trang THUẬT cho danh sách phân trang phía client (state, không
// đổi URL) — thay cho initClientListPagination() của app.js bên Flask (ẩn/
// hiện DOM bằng `display`, plan Phần 3 mục 2 quyết định bỏ hẳn pattern đó).
// Dùng cho các khối nhỏ nằm rải trong 1 trang (dashboard: "Job theo địa
// điểm", "Công ty theo thành phố", các bảng gợi ý ở 3 tab còn lại...).
// Danh sách dài cần deep-link/sort thật thì dùng phân trang qua URL
// (?page=) như app/(app)/jobs/pagination.tsx, không dùng component này.
//
// Chỉ lo phần điều khiển: nơi dùng tự giữ `page` bằng useState và tự cắt
// mảng theo slicePage(). Tự ẩn khi chỉ có 1 trang (giống Flask: khối
// pagination-list-nav trống khi số dòng <= data-paginate-size).

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cắt 1 trang (page bắt đầu từ 1) từ mảng đầy đủ. */
export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function pageCountOf(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function ListPager({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Phân trang danh sách" className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Trang trước"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft />
      </Button>
      <span aria-live="polite" className="min-w-16 text-center font-mono">
        {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Trang sau"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
