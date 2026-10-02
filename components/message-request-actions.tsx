"use client";
// components/message-request-actions.tsx
// 2 nút "Chấp nhận" / "Từ chối" của 1 dòng trong mục "Yêu cầu đang chờ" ở
// /messages (chỉ SS/admin thấy — trang không render component này cho học
// viên, và server action vẫn requireStaff() lại). Nhóm 4, Phần 1/3.
//
// Khớp Flask: bấm là chạy luôn, KHÔNG có hộp xác nhận (messages.html chỉ có
// 2 form POST thuần). Chống bấm đúp: khoá CẢ 2 nút trong lúc 1 trong 2 đang
// chạy — accept và decline trên cùng 1 request loại trừ nhau, gửi cả 2 thì
// 1 cái chắc chắn dính 409.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptMessageRequestAction,
  declineMessageRequestAction,
} from "@/lib/actions/message-actions";

type Pending = "accept" | "decline" | null;

export function MessageRequestActions({
  relationshipId,
  studentName,
}: {
  relationshipId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);

  async function run(kind: Exclude<Pending, null>) {
    if (pending) return;
    setPending(kind);
    const action = kind === "accept" ? acceptMessageRequestAction : declineMessageRequestAction;
    const result = await action(relationshipId);
    setPending(null);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
    // Yêu cầu đã được xử lý ở nơi khác: dòng này đã cũ, tải lại để biến mất.
    if (result.stale) router.refresh();
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending !== null}
        aria-label={`Chấp nhận yêu cầu của ${studentName}`}
        onClick={() => run("accept")}
      >
        {pending === "accept" ? "Đang xử lý…" : "Chấp nhận"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending !== null}
        aria-label={`Từ chối yêu cầu của ${studentName}`}
        onClick={() => run("decline")}
      >
        {pending === "decline" ? "Đang xử lý…" : "Từ chối"}
      </Button>
    </div>
  );
}
