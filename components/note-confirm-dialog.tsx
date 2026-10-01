"use client";
// components/note-confirm-dialog.tsx
// Thay cho modal CSS thủ công (#jobStatusModal/#jobDeleteModal ở
// job_detail.html). Bọc <Dialog> thật của shadcn/ui (components/ui/
// dialog.tsx, base trên @base-ui/react/dialog) — KHÔNG tự dựng overlay
// bằng div + fixed/z-50 tay như bản đầu tiên: bản tự viết thiếu focus
// trap, đóng bằng phím Esc, và aria-modal mà @base-ui/react/dialog đã
// xử lý sẵn, tự viết lại là làm tệ hơn thứ project đã có sẵn.
//
// Viết CHUNG cho mọi nơi cần "xác nhận + note tuỳ chọn/bắt buộc" chứ
// không riêng cho job status/close — đúng khuyến nghị cuối Nhóm 6 của
// plan ("Thống nhất 1 pattern xác nhận duy nhất"). Ở round Nhóm 1 này
// mới có 2 nơi dùng (đổi trạng thái job, đóng job — cả 2 đều
// noteRequired=false), các Nhóm sau (xoá company/contact, chặn học
// viên...) dùng lại đúng component này thay vì tự viết modal riêng.

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function NoteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  noteLabel = "Ghi chú (không bắt buộc)",
  notePlaceholder,
  noteRequired = false,
  initialNote = "",
  showNote = true,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  danger = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  /** Giá trị ban đầu của ô note (vd SỬA note có sẵn). Đóng dialog/lưu xong
   *  thì ô quay về đúng giá trị này; mặc định "" nên các nơi gọi cũ không đổi. */
  initialNote?: string;
  /** false = chỉ xác nhận, KHÔNG có ô note (vd đổi role ở /staff-accounts
   *  — backend không nhận note). onConfirm nhận "" và noteRequired bị bỏ qua. */
  showNote?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Trả {ok:false, message} để hiện lỗi TẠI CHỖ trong dialog (không
   *  đóng dialog) — khớp hành vi Flask flash lỗi rồi vẫn ở lại form. */
  onConfirm: (note: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [note, setNote] = useState(initialNote);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedEmpty = showNote && noteRequired && note.trim().length === 0;

  // @base-ui/react/dialog tự gọi onOpenChange(false) khi bấm Esc/click
  // backdrop/nút X — reset state ở ĐÂY (1 chỗ duy nhất) thay vì phải
  // nhớ reset ở từng nơi gọi (nút Huỷ cũ + các cách đóng khác của
  // primitive mà bản div tự viết trước đây không có).
  function handleOpenChange(next: boolean) {
    if (!next) {
      if (pending) return; // đang xử lý dở thì không cho đóng ngang
      setNote(initialNote);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (trimmedEmpty) {
      setError("Vui lòng nhập ghi chú.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await onConfirm(note.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote(initialNote);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {showNote && (
          <label className="block text-sm">
            <span className="font-medium">
              {noteLabel}
              {noteRequired && <span className="text-destructive"> *</span>}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={notePlaceholder}
              className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending || trimmedEmpty}
          >
            {pending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
