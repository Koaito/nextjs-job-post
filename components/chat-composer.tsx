"use client";
// components/chat-composer.tsx
// Ô nhập + nút Gửi dưới khung chat — thay <form class="composer"> của
// messages_thread.html. Nhóm 4, Phần 3/3.
//
// Khác Flask (plan Nhóm 4: "đây rõ ràng là chỗ Flask làm chưa tốt"): gửi bằng
// server action + optimistic update, không full-reload. Component này chỉ lo
// phần ô nhập; việc gọi server và quản lý danh sách tin do ChatThread làm, qua
// onSend().
//
// Luồng 1 lần gửi:
//   1. Kiểm tra nội dung (rỗng / quá 2000 ký tự) -> toast lỗi, GIỮ nguyên chữ.
//   2. XOÁ ô nhập ngay (tin đã hiện trên khung chat dạng "Đang gửi…").
//   3. await onSend(): true = xong. false = lỗi (ChatThread đã toast + gỡ tin
//      tạm) -> KHÔI PHỤC chữ vào ô để người dùng gửi lại, không phải gõ lại.
// Khoá nút Gửi trong lúc 1 tin đang bay: giữ đúng thứ tự gửi và không đụng rate
// limit backend (1 tin/giây). Ô nhập KHÔNG bị khoá nên vẫn gõ được tin kế tiếp.
//
// Enter xuống dòng như Flask (textarea thường, gửi bằng nút) — plan không yêu
// cầu đổi phím tắt gửi.
//
// maxLength của textarea tính theo đơn vị UTF-16 (emoji = 2) nên chặt hơn 1 chút
// so với giới hạn thật (đếm ký tự) — an toàn; kiểm tra chính xác ở bước 1.

import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MESSAGE_MAX_LENGTH, validateMessageContent } from "@/lib/messages";

export function ChatComposer({ onSend }: { onSend: (content: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const invalid = validateMessageContent(text);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    const content = text.trim();
    setSending(true);
    setText("");
    const ok = await onSend(content);
    setSending(false);

    if (!ok) {
      // Người dùng có thể đã gõ tiếp trong lúc chờ: đặt tin lỗi lên trước, không
      // ghi đè phần mới gõ.
      setText((current) => (current ? `${content}\n${current}` : content));
    }
    textareaRef.current?.focus();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2.5 border-t border-border bg-[var(--brand-bg)] px-[18px] py-3.5"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MESSAGE_MAX_LENGTH}
        rows={2}
        placeholder="Nhập tin nhắn..."
        aria-label="Nội dung tin nhắn"
        className="max-h-40 min-h-[52px] flex-1 resize-none rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" disabled={sending}>
        {sending ? "Đang gửi…" : "Gửi"}
      </Button>
    </form>
  );
}
