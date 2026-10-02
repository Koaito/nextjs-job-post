// lib/messages.ts
// Helper thuần (không đụng server/API) dùng chung cho các trang Messages.
// Nhóm 4 — Messages, Phần 1/3.

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
