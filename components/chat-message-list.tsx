// components/chat-message-list.tsx
// Khung cuộn danh sách tin nhắn của /messages/[partnerId] — thay phần
// #chatMessages của messages_thread.html + app.js bên Flask. Nhóm 4.
//
// TRƯỚC (Phần 2/3 nửa đầu) file này giữ state + cuộn. TỪ Phần 2/3 nửa sau,
// state tin nhắn, polling, quy tắc `wasAtBottom` và việc gửi tin sống ở
// components/chat-thread.tsx (cần 1 chủ duy nhất cho state vì polling, ô gửi
// tin và optimistic update cùng ghi vào danh sách). File này chỉ còn VẼ danh
// sách; ref của khung cuộn do ChatThread truyền xuống để tự đo/đặt scrollTop.
// Không có "use client" vì không dùng hook/sự kiện nào — được ghép vào cây
// client của ChatThread.
//
// XSS (plan: nội dung tin CHỈ render text thuần): content luôn đi qua JSX
// `{m.content}` (React tự escape). Không có dangerouslySetInnerHTML ở đây,
// và KHÔNG được thêm vào dù để hỗ trợ xuống dòng — xuống dòng đã có sẵn nhờ
// `whitespace-pre-wrap`. `[overflow-wrap:anywhere]` để 1 chuỗi dài không
// khoảng trắng tự bẻ dòng thay vì tràn ra ngoài khung.

import type { Ref } from "react";
import type { ChatMessageView } from "@/lib/messages";

/** Tin đang gửi (optimistic): đã hiện trên UI nhưng backend chưa xác nhận. */
export interface PendingChatMessage {
  /** Id tạm phía client (không bao giờ trùng id số của backend). */
  tempId: string;
  content: string;
}

function Bubble({
  content,
  footer,
  outgoing,
  dataId,
  pending = false,
}: {
  content: string;
  footer: string;
  outgoing: boolean;
  dataId?: number;
  pending?: boolean;
}) {
  return (
    <div
      data-id={dataId}
      className={
        "flex max-w-[85%] flex-col sm:max-w-[62%] " +
        (outgoing ? "items-end self-end" : "items-start self-start") +
        (pending ? " opacity-60" : "")
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
        {content}
      </div>
      <div className="mt-[3px] px-1 text-[10.5px] text-muted-foreground">{footer}</div>
    </div>
  );
}

export function ChatMessageList({
  messages,
  pendingMessages,
  viewerId,
  partnerName,
  emptyText,
  containerRef,
}: {
  messages: ChatMessageView[];
  /** Tin đang gửi — luôn là của người xem, luôn nằm cuối danh sách. */
  pendingMessages: PendingChatMessage[];
  viewerId: string;
  partnerName: string;
  /** null = KHÔNG hiện trạng thái rỗng (vd tải lịch sử lỗi: "chưa có tin
   *  nhắn" lúc đó sẽ là thông tin sai). */
  emptyText: string | null;
  containerRef: Ref<HTMLDivElement>;
}) {
  const viewer = viewerId.toLowerCase();
  const isEmpty = messages.length === 0 && pendingMessages.length === 0;

  return (
    <div
      ref={containerRef}
      role="log"
      aria-label={`Tin nhắn với ${partnerName}`}
      className="flex h-[56vh] min-h-[280px] flex-col gap-2.5 overflow-y-auto p-[22px]"
    >
      {isEmpty ? (
        emptyText && <p className="py-10 text-center text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          {messages.map((m) => (
            <Bubble
              key={m.id}
              dataId={m.id}
              content={m.content}
              footer={m.timeLabel}
              outgoing={m.senderId.toLowerCase() === viewer}
            />
          ))}
          {pendingMessages.map((p) => (
            <Bubble key={p.tempId} content={p.content} footer="Đang gửi…" outgoing pending />
          ))}
        </>
      )}
    </div>
  );
}
