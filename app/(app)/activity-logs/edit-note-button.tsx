"use client";
// app/(app)/activity-logs/edit-note-button.tsx
// Nút "Sửa note" + Dialog sửa ghi chú của 1 dòng log — Nhóm 3, Đợt 3.4,
// Phần 4/5. Thay cho modal CSS + <form method="post"> full-reload của
// Flask; dùng lại <NoteConfirmDialog> (pattern xác nhận+note chung của repo)
// thay vì viết dialog riêng. Mỗi dòng 1 nút nhưng dialog chỉ mount nội
// dung khi mở (base-ui Dialog), không render N modal ẩn.
//
// Ô note BẮT BUỘC (noteRequired): tự .trim() trước khi gửi (xem
// NoteConfirmDialog), nút Lưu khoá khi rỗng. Lỗi 403/409/422/404 từ action
// hiện ngay trong dialog, không đóng.
//
// Cha (table) truyền `key` đổi theo note hiện tại để dialog dựng lại với
// initialNote mới sau khi lưu — không để ô note giữ giá trị cũ.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { updateAuditLogNoteAction } from "@/lib/actions/audit-log-actions";

export function EditNoteButton({
  logId,
  currentNote,
  logSummary,
}: {
  logId: string;
  currentNote: string;
  /** Mô tả ngắn log đang sửa (vd "Sửa JD: Backend Dev") cho phần mô tả dialog. */
  logSummary: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    // Không đổi gì -> chỉ đóng, khỏi gọi API và khỏi làm mới "Sửa: <giờ>".
    if (note === currentNote.trim()) return { ok: true, message: "" };
    const result = await updateAuditLogNoteAction(logId, note);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    }
    return result;
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Sửa note
      </Button>
      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sửa ghi chú"
        description={logSummary}
        noteLabel="Ghi chú"
        notePlaceholder="Nhập ghi chú…"
        noteRequired
        initialNote={currentNote}
        confirmLabel="Lưu ghi chú"
        onConfirm={handleConfirm}
      />
    </>
  );
}
