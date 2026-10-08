// lib/auth-channel.ts
// Đồng bộ "phiên đã kết thúc" giữa các tab cùng trình duyệt bằng
// BroadcastChannel (Phụ lục C mục 3 của plan): tab A gặp lỗi trước thì tab B
// đang mở nhàn rỗi (chưa tự gọi API nào) cũng được báo ngay, không phải đợi
// tới lúc tự nhận 401.
//
// LỆCH NHỎ so với đoạn code mẫu của plan: plan gửi chuỗi trơn "session-revoked"
// (1 tín hiệu cho cả 2 loại lỗi). Ở đây gửi kèm `reason` để tab nhận hiện đúng
// message (replaced khác revoked — Phụ lục C bước 2 yêu cầu không dùng chung).
//
// CHỈ import từ Client Component / code chạy trong trình duyệt.

import type { SessionEndReason } from "@/lib/session-end";

const CHANNEL_NAME = "mx-auth";

interface SessionEndedMessage {
  type: "session-ended";
  reason: SessionEndReason;
}

function isSessionEndedMessage(data: unknown): data is SessionEndedMessage {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === "session-ended" && (d.reason === "replaced" || d.reason === "revoked");
}

function openChannel(): BroadcastChannel | null {
  // Trình duyệt rất cũ / môi trường không có BroadcastChannel -> bỏ qua êm,
  // tab khác sẽ tự phát hiện khi gọi API kế tiếp như bình thường.
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

/** Báo cho CÁC TAB KHÁC (BroadcastChannel không bắn lại cho chính tab gửi). */
export function broadcastSessionEnded(reason: SessionEndReason): void {
  const channel = openChannel();
  if (!channel) return;
  channel.postMessage({ type: "session-ended", reason } satisfies SessionEndedMessage);
  channel.close();
}

/** Lắng nghe tín hiệu từ tab khác. Trả về hàm huỷ đăng ký. */
export function subscribeSessionEnded(
  onEnded: (reason: SessionEndReason) => void,
): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (e: MessageEvent) => {
    if (isSessionEndedMessage(e.data)) onEnded(e.data.reason);
  };
  return () => channel.close();
}
