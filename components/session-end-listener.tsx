"use client";

// components/session-end-listener.tsx
// Phụ lục C — gắn 1 lần ở app/(app)/layout.tsx. Làm 2 việc:
//
//  1. Lắng nghe tín hiệu từ TAB KHÁC (BroadcastChannel): tab kia đã phát hiện
//     phiên chết thì tab này (kể cả đang mở nhàn rỗi, chưa gọi API nào) dọn
//     cookie và sang /login ngay, không đợi tới lúc tự nhận 401.
//
//  2. Xử lý trường hợp layout (Server Component) vừa phát hiện phiên chết ở
//     1 TRANG CÔNG KHAI (/jobs, /jobs/[id]) — nơi không có guard nào redirect
//     sang /login. Ở đây người dùng đang xem trang công khai nên KHÔNG đá họ
//     sang /login: hiện toast giải thích, dọn cookie chết, rồi làm mới trang
//     để hiện đúng trạng thái khách. (Trang cần đăng nhập thì requireUser()
//     đã redirect sang /login?reason=... từ phía server, tới đây không bao
//     giờ có `reason`.)

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { broadcastSessionEnded, subscribeSessionEnded } from "@/lib/auth-channel";
import { clearSessionCookies, handleSessionEnded } from "@/lib/session-end-client";
import { SESSION_END_MESSAGES, type SessionEndReason } from "@/lib/session-end";

export function SessionEndListener({ reason }: { reason: SessionEndReason | null }) {
  const router = useRouter();

  useEffect(() => {
    return subscribeSessionEnded((r) => {
      void handleSessionEnded(r, { broadcast: false });
    });
  }, []);

  useEffect(() => {
    if (!reason) return;
    // id cố định: không chồng nhiều toast giống nhau nếu effect chạy lại
    // (React Strict Mode ở dev chạy effect 2 lần).
    toast.error(SESSION_END_MESSAGES[reason], { id: "session-ended", duration: 10_000 });
    broadcastSessionEnded(reason);
    // Xoá xong mới refresh: sau khi cookie chết biến mất, layout tính lại
    // thành khách thường (reason = null) nên effect này không chạy lại.
    void clearSessionCookies().then(() => router.refresh());
  }, [reason, router]);

  return null;
}
