"use client";
// app/(app)/dashboard/bar-list.tsx
// Danh sách BarRow có phân trang phía client (20 dòng/trang) — thay cho
// khối data-paginate-size="20" + initClientListPagination() bên Flask ở
// "Job theo địa điểm" và "Công ty theo thành phố" (số tỉnh/thành có thể
// vượt 20). Nhận mảng đã tính sẵn từ Server Component (chỉ truyền dữ
// liệu thuần, không truyền hàm) và tự giữ số trang bằng useState.

import { useState } from "react";
import { ListPager, pageCountOf, slicePage } from "@/components/list-pager";
import type { BarItem } from "@/lib/dashboard/overview";
import { BarRow } from "./bar-row";

export const BAR_LIST_PAGE_SIZE = 20;

export function PaginatedBarList({
  items,
  total,
  variant = "accent",
  pageSize = BAR_LIST_PAGE_SIZE,
}: {
  items: BarItem[];
  total: number;
  variant?: "accent" | "teal";
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const pageCount = pageCountOf(items.length, pageSize);
  // Dữ liệu đổi (vd sau router.refresh) làm số trang co lại -> kẹp lại để
  // không kẹt ở 1 trang không còn tồn tại.
  const safePage = Math.min(page, pageCount);

  return (
    <div>
      {slicePage(items, safePage, pageSize).map((item) => (
        <BarRow key={item.label} label={item.label} value={item.value} total={total} variant={variant} />
      ))}
      <ListPager page={safePage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
