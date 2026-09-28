"use client";
// components/delete-contact-button.tsx
// Nút "Xóa" (xoá MỀM) contact — Nhóm 2, Phần 2, mục 5 của plan. Dùng chung ở
// /contacts và /companies/[companyId].
//
// Sửa bug Flask (plan dòng 988): nút Xóa ở _contact_list.html dùng confirm()
// suông, không gửi note dù backend luôn bắt buộc (nên luôn thất bại), và
// redirect cứng về trang công ty. Ở đây: (1) <NoteConfirmDialog noteRequired>
// xin note bắt buộc, (2) xoá xong Ở LẠI đúng trang đang đứng (toast + refresh),
// không điều hướng đi đâu.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteContactAction } from "@/lib/actions/contact-actions";

export function DeleteContactButton({
  companyId,
  contactId,
  contactName,
}: {
  companyId: string;
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    const result = await deleteContactAction(companyId, contactId, note);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    }
    return result;
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setOpen(true)}>
        Xóa
      </Button>
      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Xoá người liên hệ"
        description={
          <>
            &ldquo;{contactName}&rdquo; sẽ bị xoá mềm — ẩn khỏi danh sách, chưa mất hẳn dữ liệu. Có thể xem lại (và
            xoá hẳn nếu cần) ở khối &ldquo;Đã xoá&rdquo; trong trang công ty.
          </>
        }
        noteLabel="Lý do xoá"
        notePlaceholder="VD: nghỉ việc, sai thông tin, trùng lặp…"
        noteRequired
        confirmLabel="Xoá"
        danger
        onConfirm={handleConfirm}
      />
    </>
  );
}
