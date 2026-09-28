"use client";
// components/withdraw-application-button.tsx
// Nút + hộp thoại HUỶ ỨNG TUYỂN — Nhóm 5, Đợt 5.3 của plan. DÙNG CHUNG cho
// 2 nơi (plan: "nên dùng chung đúng 1 Dialog huỷ, kèm ô ghi chú không bắt
// buộc, cho cả 2 nơi thay vì giữ 2 cách khác nhau"):
//   - trang chi tiết job (variant "detail": nút "✅ Đã ứng tuyển · Bấm để huỷ")
//   - /profile/applications (variant "list": nút "Huỷ ứng tuyển")
// Bản Flask ở trang danh sách chỉ có confirm() thuần, không có ô ghi chú —
// ở đây cả 2 nơi đều có.
//
// Bước xác nhận nêu rõ CV đã nộp sẽ bị XOÁ khỏi hệ thống (plan: không coi
// đây là thao tác đổi trạng thái đơn thuần). Note lý do KHÔNG bắt buộc.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { Button } from "@/components/ui/button";
import { withdrawApplicationAction } from "@/lib/actions/application-actions";

export function WithdrawApplicationButton({
  jobId,
  jobTitle,
  companyName,
  variant,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  variant: "detail" | "list";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleConfirm(note: string) {
    const result = await withdrawApplicationAction(jobId, note);
    if (result.ok) {
      toast.success(result.message);
      // Action đã revalidate; refresh để trang (Server Component) đọc lại
      // trạng thái: chi tiết job hiện lại nút "Ứng tuyển ngay", danh sách
      // bỏ card vừa huỷ.
      router.refresh();
    }
    return result;
  }

  return (
    <>
      {variant === "detail" ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          ✅ Đã ứng tuyển · Bấm để huỷ
        </Button>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(true)}>
          Huỷ ứng tuyển
        </Button>
      )}

      <NoteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Huỷ ứng tuyển"
        description={
          <>
            Bạn sắp huỷ ứng tuyển vị trí <strong>{jobTitle}</strong> — {companyName}.{" "}
            <strong>CV đã nộp sẽ bị xoá khỏi hệ thống</strong> và không khôi phục được; bạn có thể ứng tuyển
            lại sau nếu đổi ý.
          </>
        }
        noteLabel="Lý do huỷ (không bắt buộc)"
        notePlaceholder="Cho Team SS biết vì sao bạn đổi ý, để team hỗ trợ tốt hơn lần sau…"
        confirmLabel="Xác nhận huỷ ứng tuyển"
        cancelLabel="Đóng"
        danger
        onConfirm={handleConfirm}
      />
    </>
  );
}
