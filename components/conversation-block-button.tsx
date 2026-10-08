"use client";
// components/conversation-block-button.tsx
// Nút "Chặn" / "Bỏ chặn" học viên ở mỗi dòng hội thoại của /messages (Phần 1/3)
// và ở đầu trang chat /messages/[partnerId] (Phần 3/3) — cùng 1 component.
//
// Chỉ render cho SS/admin VÀ khi đối phương là học viên (trang quyết định,
// khớp điều kiện `partner_role == 'user'` của messages.html); server action
// vẫn requireStaff() lại.
//
//   - Chặn: hiện hộp xác nhận (Flask: confirm() thuần, plan Nhóm 4 gom về
//     NoteConfirmDialog, KHÔNG có ô note vì backend /block không nhận note —
//     cùng cách đổi role ở /staff-accounts).
//   - Bỏ chặn: chạy luôn không xác nhận (khớp Flask, thao tác an toàn).
//   - Đang chặn mà thiếu relationship_id: KHÔNG hiện nút (không có gì để gọi
//     — edge case đã biết ở plan Nhóm 4, giữ nguyên hành vi Flask).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteConfirmDialog } from "@/components/note-confirm-dialog";
import { blockStudentAction, unblockStudentAction } from "@/lib/actions/message-actions";

/** Lề mặc định cho nút nằm cuối 1 dòng danh sách hội thoại (/messages). */
const LIST_ROW_SPACING = "mr-3.5";

export function ConversationBlockButton({
  studentId,
  studentName,
  blocked,
  relationshipId,
  spacingClassName = LIST_ROW_SPACING,
}: {
  studentId: string;
  studentName: string;
  blocked: boolean;
  relationshipId: string | null;
  /** Lớp lề ngoài của nút. Mặc định là lề phải của dòng danh sách; ở header
   *  trang chat truyền "" để không thừa lề. */
  spacingClassName?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unblocking, setUnblocking] = useState(false);

  async function handleUnblock() {
    if (unblocking || !relationshipId) return;
    setUnblocking(true);
    const result = await unblockStudentAction(relationshipId);
    setUnblocking(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
    if (result.stale) router.refresh();
  }

  if (blocked) {
    if (!relationshipId) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`${spacingClassName} shrink-0`}
        disabled={unblocking}
        aria-label={`Bỏ chặn ${studentName}`}
        onClick={handleUnblock}
      >
        {unblocking ? "Đang xử lý…" : "Bỏ chặn"}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`${spacingClassName} shrink-0 text-destructive hover:text-destructive`}
        aria-label={`Chặn ${studentName}`}
        onClick={() => setConfirmOpen(true)}
      >
        Chặn
      </Button>

      <NoteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        showNote={false}
        danger
        title="Chặn học viên này?"
        description={
          <>
            Chặn <strong>{studentName}</strong>? Học viên này sẽ không nhắn tin được cho bạn nữa (bạn vẫn xem
            được lịch sử và có thể bỏ chặn sau).
          </>
        }
        confirmLabel="Chặn"
        onConfirm={async () => {
          const result = await blockStudentAction(studentId);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else if (result.stale) {
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}
