"use client";
// app/(app)/dashboard/paginated-table.tsx
// Bảng có phân trang phía client (20 dòng/trang) — thay cho khối
// <tbody data-paginate-size="20"> + <div class="pagination-list-nav"> +
// initClientListPagination() bên Flask ở các bảng của dashboard (JD sắp hết
// hạn, JD "ế", khoảng lương... và các bảng của 2 tab còn lại).
//
// Server Component dựng sẵn từng <tr> (ReactNode thuần, serialize được qua
// ranh giới server -> client) rồi truyền vào `rows`; component này chỉ giữ
// số trang bằng useState và cắt mảng bằng slicePage(). Nhờ vậy nơi dùng vẫn
// là Server Component, không phải truyền hàm render xuống Client Component.
// Mỗi <tr> truyền vào PHẢI có `key` ổn định (vd job_id).

import { useState, type ReactNode } from "react";
import { ListPager, pageCountOf, slicePage } from "@/components/list-pager";

export const TABLE_PAGE_SIZE = 20;

export function PaginatedTable({
  head,
  rows,
  pageSize = TABLE_PAGE_SIZE,
}: {
  /** Nội dung <thead> (thường là 1 <tr> với các <th>). */
  head: ReactNode;
  rows: ReactNode[];
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const pageCount = pageCountOf(rows.length, pageSize);
  // Dữ liệu đổi (vd sau router.refresh) làm số trang co lại -> kẹp lại để
  // không kẹt ở 1 trang không còn tồn tại.
  const safePage = Math.min(page, pageCount);

  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">{head}</thead>
          <tbody>{slicePage(rows, safePage, pageSize)}</tbody>
        </table>
      </div>
      <ListPager page={safePage} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}
