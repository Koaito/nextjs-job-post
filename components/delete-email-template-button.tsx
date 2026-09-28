"use client";
// components/delete-email-template-button.tsx
// Nút "Xóa" mẫu email — Nhóm 2, Phần 3 của plan. Thay window.prompt() của
// Flask (et_confirmDelete) bằng <NoteConfirmDialog noteRequired> — cùng
// pattern DeleteContactButton, plan cuối Nhóm 6 "thống nhất 1 pattern xác
// nhận duy nhất".
//
// Xoá HẲN thật (không soft-delete, KHÁC company/contact): không có UI
// "khôi phục", chỉ cần cảnh báo không hoàn tác được (plan Nhóm 2). Xoá xong
// Ở LẠI trang (toast + router.refresh()), không điều hướng.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteEmailTemplateAction } from "@/lib/actions/email-template-actions";

export function DeleteEmailTemplateButton({
  templateId,
  templateTitle,
}: {
  templateId: string;
  templateTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    const result = await deleteEmailTemplateAction(templateId, note);
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
        title="Xoá mẫu email"
        description={
          <>
            Mẫu &ldquo;{templateTitle}&rdquo; sẽ bị xoá hẳn khỏi hệ thống và không thể khôi phục. Mọi staff sẽ không
            còn thấy mẫu này trong popup &ldquo;✉ Mẫu email&rdquo;.
          </>
        }
        noteLabel="Lý do xoá"
        notePlaceholder="VD: không còn phù hợp, trùng nội dung mẫu khác…"
        noteRequired
        confirmLabel="Xoá hẳn"
        danger
        onConfirm={handleConfirm}
      />
    </>
  );
}
