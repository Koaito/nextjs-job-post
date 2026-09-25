"use client";
// app/(app)/companies/[companyId]/hard-delete-contact-button.tsx
// Phần 2, mục 6 — nút "Xoá hẳn" chỉ hiện ở khối "Đã xoá" (contact đã
// is_active=false) trên trang company detail, khớp luồng 2 bước của
// Flask (company_detail.html): xoá mềm trước (thuộc Phần 2 mục 1/2,
// đang làm ở phiên khác) → "Xoá hẳn" chỉ dọn nốt bước 2.
//
// Khác nút "Xoá hẳn" ở Flask (confirm() suông, KHÔNG có ô note — 1 trong
// các chỗ đã liệt kê ở Plan_NextJS.md dòng 1108): Next.js dùng
// <NoteConfirmDialog noteRequired> vì backend giờ đã bắt buộc note (bug
// fix ở Plan_NextJS.md mục 3.12), không phân biệt UX "bước 2 nhẹ tay
// hơn bước 1" (dòng 324 của plan).

import { useState } from "react";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button } from "@/components/ui/button";
import { hardDeleteContactAction } from "@/lib/actions/contact-actions";

export function HardDeleteContactButton({
  companyId,
  contactId,
  contactName,
}: {
  companyId: string;
  contactId: string;
  contactName: string;
}) {
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    return hardDeleteContactAction(companyId, contactId, note);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
        Xoá hẳn
      </Button>
      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xoá hẳn người liên hệ"
        description={
          <>
            &ldquo;{contactName}&rdquo; sẽ bị xoá HẲN khỏi hệ thống, không thể khôi phục lại. Nếu người liên hệ này
            từng gắn với 1 job cụ thể, hệ thống sẽ báo lỗi và giữ nguyên trạng thái đã xoá mềm.
          </>
        }
        noteLabel="Lý do xoá hẳn"
        notePlaceholder="Nhập lý do xoá hẳn người liên hệ này…"
        noteRequired
        confirmLabel="Xoá hẳn"
        danger
        onConfirm={handleConfirm}
      />
    </>
  );
}
