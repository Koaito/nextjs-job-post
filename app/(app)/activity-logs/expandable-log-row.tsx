"use client";
// app/(app)/activity-logs/expandable-log-row.tsx
// 1 dòng log + (khi bấm "Xem thay đổi") 1 dòng con bên dưới — Nhóm 3, Đợt
// 3.4, Phần 5/5. Chỉ giữ trạng thái mở/đóng; mọi ô nội dung và nội dung
// dòng con vẫn do Server Component dựng rồi truyền vào qua props, nên bảng
// không phải chuyển hẳn sang client. Log không có `changes` thì không có nút.

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ExpandableLogRow({
  logId,
  cells,
  actions,
  detail,
  colSpan,
}: {
  logId: string;
  /** Các <td> từ cột "Thời gian" đến "Ghi chú" (đã dựng sẵn ở server). */
  cells: ReactNode;
  /** Nút "Sửa note" (hoặc null). */
  actions: ReactNode;
  /** Nội dung dòng con; null/undefined = log không có thay đổi để xem. */
  detail?: ReactNode;
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  const detailId = `log-changes-${logId}`;

  return (
    <>
      <tr className="border-b align-top last:border-0">
        {cells}
        <td className="px-3 py-2">
          <div className="flex flex-col items-start gap-1">
            {detail ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? "Ẩn thay đổi" : "Xem thay đổi"}
              </Button>
            ) : null}
            {actions}
          </div>
        </td>
      </tr>
      {detail && open && (
        <tr id={detailId} className="border-b bg-muted/30">
          <td colSpan={colSpan} className="px-3 py-3">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
