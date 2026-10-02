"use client";
// components/chat-message-list.tsx
// Khung cuộn danh sách tin nhắn của /messages/[partnerId] — thay phần
// #chatMessages + initChatPolling() của app.js bên Flask. Nhóm 4, Phần 2/3,
// NỬA ĐẦU: chỉ hiện tin đã tải sẵn từ server và cuộn xuống cuối lúc mở trang.
// Nửa sau sẽ thêm polling nhận tin mới + quy tắc `wasAtBottom` vào CHÍNH
// component này (state `messages` đã tách riêng khỏi props để dễ nối thêm).
//
// Vì sao cần client component dù dữ liệu tải ở server: chỉ để cuộn xuống tin
// mới nhất lúc mở (Flask: container.scrollTop = container.scrollHeight).
// useLayoutEffect (không phải useEffect) để cuộn TRƯỚC khi trình duyệt vẽ —
// dùng useEffect sẽ thấy 1 nháy tin cũ nhất rồi mới nhảy xuống cuối.
//
// XSS (plan: nội dung tin CHỈ render text thuần): content luôn đi qua JSX
// `{m.content}` (React tự escape). Không có dangerouslySetInnerHTML ở đây,
// và KHÔNG được thêm vào dù để hỗ trợ xuống dòng — xuống dòng đã có sẵn nhờ
// `whitespace-pre-wrap`. `[overflow-wrap:anywhere]` để 1 chuỗi dài không
// khoảng trắng tự bẻ dòng thay vì tràn ra ngoài khung.

import { useLayoutEffect, useRef, useState } from "react";

/** Dạng gọn của 1 tin — chỉ các field cần hiển thị, để KHÔNG đẩy cả
 *  ChatMessageOut (read_at, receiver_id...) xuống trình duyệt. */
export interface ChatMessageView {
  id: number;
  senderId: string;
  content: string;
  /** Đã định dạng sẵn ở server theo giờ VN (tránh lệch múi giờ + hydration). */
  timeLabel: string;
}

export function ChatMessageList({
  initialMessages,
  viewerId,
  partnerName,
  emptyText,
}: {
  initialMessages: ChatMessageView[];
  viewerId: string;
  partnerName: string;
  /** null = KHÔNG hiện trạng thái rỗng (vd tải lịch sử lỗi: "chưa có tin
   *  nhắn" lúc đó sẽ là thông tin sai). */
  emptyText: string | null;
}) {
  const [messages] = useState(initialMessages);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const viewer = viewerId.toLowerCase();

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label={`Tin nhắn với ${partnerName}`}
      className="flex h-[56vh] min-h-[280px] flex-col gap-2.5 overflow-y-auto p-[22px]"
    >
      {messages.length === 0 ? (
        emptyText && <p className="py-10 text-center text-muted-foreground">{emptyText}</p>
      ) : (
        messages.map((m) => {
          const outgoing = m.senderId.toLowerCase() === viewer;
          return (
            <div
              key={m.id}
              data-id={m.id}
              className={
                "flex max-w-[85%] flex-col sm:max-w-[62%] " +
                (outgoing ? "items-end self-end" : "items-start self-start")
              }
            >
              <div
                className={
                  "whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-sm leading-[1.45] [overflow-wrap:anywhere] " +
                  (outgoing
                    ? "rounded-br-[4px] bg-[var(--brand-accent)] text-white"
                    : "rounded-bl-[4px] bg-[var(--brand-bg)] text-[var(--brand-ink)]")
                }
              >
                {m.content}
              </div>
              <div className="mt-[3px] px-1 text-[10.5px] text-muted-foreground">{m.timeLabel}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
