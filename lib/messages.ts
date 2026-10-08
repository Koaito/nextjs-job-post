// lib/messages.ts
// Helper thuần (không đụng server/API) dùng chung cho các trang Messages.
// Nhóm 4 — Messages, Phần 1/3 + Phần 2/3 (nửa sau) + Phần 3/3.
//
// Chỉ `import type` từ lib/api/messages (bị xoá lúc biên dịch) nên file này
// vẫn import được an toàn từ Client Component, không kéo theo callAuthed/
// next/headers vào bundle trình duyệt.

import { formatMessageTimeVN } from "@/lib/date";
import type { ChatMessageOut } from "@/lib/api/messages";

/**
 * Link tới khung chat của 1 người, mang sẵn ?name=&role= — plan Nhóm 4:
 * không có API "lấy 1 người theo id" dùng chung cho mọi role nên tên/role
 * người đối thoại đi theo query string của chính link điều hướng (Flask:
 * url_for('messages.thread', partner_id, name, role)). Dùng URLSearchParams
 * để mã hoá đúng dấu tiếng Việt và ký tự đặc biệt trong tên.
 */
export function buildThreadHref(partnerId: string, name: string, role: string): string {
  const params = new URLSearchParams();
  if (name) params.set("name", name);
  if (role) params.set("role", role);
  const qs = params.toString();
  return `/messages/${encodeURIComponent(partnerId)}${qs ? `?${qs}` : ""}`;
}

/** Chữ cái viết hoa đầu tiên của tên cho avatar tròn; "?" nếu tên rỗng.
 *  Array.from để không cắt đôi ký tự ngoài BMP (emoji trong tên). */
export function avatarInitial(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toLocaleUpperCase("vi") : "?";
}

/** Số tin chưa đọc hiển thị trên huy hiệu — trên 99 thì "99+" (khớp Flask). */
export function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** id người dùng/quan hệ do backend sinh luôn là UUID. Server action nhận id
 *  từ client (gọi tay được) nên kiểm tra hình dạng trước khi chạm backend —
 *  chuỗi lạ có thể làm query uuid ở backend nổ 500 thay vì 404/422. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** 2 id có phải cùng 1 người không (so không phân biệt hoa/thường, vì UUID
 *  gõ tay trên URL có thể viết hoa). Dùng chặn tự chat với chính mình. */
export function isSameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/** Tham số query có thể là chuỗi, mảng (?name=a&name=b) hoặc không có. */
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Tên người đối thoại tối đa 100 ký tự khi lấy từ URL (full_name backend
 *  cho tới 255, nhưng đây chỉ là gợi ý dự phòng — không để URL tự đặt 1
 *  chuỗi dài làm vỡ tiêu đề). */
export const PARTNER_NAME_FROM_URL_MAX = 100;

/** Dạng gọn của 1 tin — chỉ các field cần hiển thị, để KHÔNG đẩy cả
 *  ChatMessageOut (read_at, receiver_id...) xuống trình duyệt. Dùng chung cho
 *  tin tải lúc mở trang (page.tsx), tin polling (Route Handler since) và tin
 *  vừa gửi (server action) — cả 3 nơi đều đi qua toChatMessageView() nên
 *  luôn cùng 1 dạng + cùng 1 cách định dạng giờ. */
export interface ChatMessageView {
  id: number;
  senderId: string;
  content: string;
  /** Đã định dạng sẵn ở server theo giờ VN (tránh lệch múi giờ + hydration). */
  timeLabel: string;
}

export function toChatMessageView(m: ChatMessageOut): ChatMessageView {
  return {
    id: m.id,
    senderId: m.sender_id,
    content: m.content,
    timeLabel: formatMessageTimeVN(m.created_at),
  };
}

/** Giới hạn độ dài 1 tin — khớp CHECK char_length(btrim(content)) BETWEEN 1
 *  AND 2000 ở backend và MAX_CONTENT_LENGTH của Flask. */
export const MESSAGE_MAX_LENGTH = 2000;

/** Đếm theo KÝ TỰ (code point) như len() của Python/Pydantic ở backend, không
 *  phải đơn vị UTF-16 của String.length — 1 emoji là 1 ký tự ở backend nhưng
 *  .length của JS tính 2, đếm sai sẽ chặn oan tin còn nằm trong giới hạn. */
export function countMessageChars(text: string): number {
  return Array.from(text).length;
}

/** Kiểm tra nội dung tin TRƯỚC khi gọi backend (double-check như Flask, backend
 *  mới là lớp chặn thật). Trả câu lỗi tiếng Việt, hoặc null nếu hợp lệ. Dùng
 *  chung cho ô nhập (client) và server action để 2 nơi không lệch nhau. */
export function validateMessageContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return "Vui lòng nhập nội dung tin nhắn.";
  if (countMessageChars(trimmed) > MESSAGE_MAX_LENGTH) {
    return `Tin nhắn không được vượt quá ${MESSAGE_MAX_LENGTH} ký tự.`;
  }
  return null;
}
