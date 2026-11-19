"use client";
// app/(app)/crawl/close-job-button.tsx
// Nút "Đóng job này" ở hai bảng của tab Tình trạng dữ liệu. Có bước xác nhận (NoteConfirmDialog, pattern chung của
// app; Flask dùng confirm() thuần) nhưng KHÔNG có ô note: note là câu cố định do server điền theo `kind`, ở đây chỉ HIỆN
// câu đó trong hộp xác nhận để người bấm biết lý do nào sẽ vào lịch sử thao tác.
// Thành công: toast + router.refresh() (dòng biến mất khỏi bảng). Lỗi hiện ngay trong hộp xác nhận; job không còn (404)
// thì báo bằng toast rồi tải lại danh sách.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { closeJobFromDataHealthAction } from "@/lib/actions/data-health-actions";
import { CLOSE_JOB_NOTES, type CloseJobKind } from "@/lib/data-ops/data-health";

export function CloseJobButton({
  jobId,
  jobTitle,
  kind,
}: {
  jobId: string;
  jobTitle: string;
  kind: CloseJobKind;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Đóng job ${jobTitle}`}
      >
        Đóng job này
      </Button>
      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Đóng job này?"
        description={
          <>
            Job &ldquo;{jobTitle}&rdquo; sẽ chuyển sang Đã đóng. Lý do ghi vào lịch sử thao tác:{" "}
            <span data-testid="close-job-note">{CLOSE_JOB_NOTES[kind]}</span>
          </>
        }
        showNote={false}
        danger
        confirmLabel="Đóng job"
        onConfirm={async () => {
          const result = await closeJobFromDataHealthAction(jobId, kind);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else if (result.stale) {
            // Job đã mất: tải lại làm dòng (và hộp xác nhận gắn với dòng) biến mất, nên báo bằng toast chứ không
            // chỉ trong hộp xác nhận, kẻo người dùng chỉ thấy hộp nháy rồi tắt mà không biết vì sao.
            toast.error(result.message);
            router.refresh();
          }
          return { ok: result.ok, message: result.message };
        }}
      />
    </>
  );
}
