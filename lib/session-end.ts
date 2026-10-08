// lib/session-end.ts
// Phụ lục C của plan — phân biệt "phiên đăng nhập kết thúc" theo error_code.
//
// File THUẦN (không import next/headers, không đụng window) để dùng chung ở
// mọi nơi: proxy.ts, Server Component, Route Handler lẫn Client Component.
//
// QUAN TRỌNG: so sánh theo GIÁ TRỊ CHUỖI THẬT trong response (cột bên phải
// bảng ở Phụ lục C), KHÔNG theo tên hằng số backend (SESSION_REPLACED...) và
// không đoán theo quy tắc đặt tên — 2 cột không có quy tắc nhất quán.
//
//   hằng số backend                       -> giá trị chuỗi thật
//   SESSION_REPLACED                      -> session_replaced
//   SESSION_REVOKED                       -> session_revoked
//   AUTH_REFRESH_TOKEN_ALREADY_REVOKED    -> auth_refresh_token_thu_hoi_truoc
//
// 2 mã còn lại của refresh (AUTH_REFRESH_TOKEN_EXPIRED = auth_expired_2,
// AUTH_REFRESH_TOKEN_INVALID = auth_invalid_2) cố ý KHÔNG nằm ở đây: hết
// hạn 30 ngày là chuyện bình thường, chỉ cần quay về /login lặng lẽ, không
// cần thông báo gì.

/** replaced = bị đăng nhập ở nơi khác thay thế (dấu hiệu có thể bị chiếm
 *  tài khoản); revoked = phiên bị thu hồi do chính chủ đăng xuất/đổi mật
 *  khẩu. 2 nguyên nhân + 2 message khác nhau — không dùng chung. */
export type SessionEndReason = "replaced" | "revoked";

const CODE_TO_REASON: Record<string, SessionEndReason> = {
  session_replaced: "replaced",
  auth_refresh_token_thu_hoi_truoc: "replaced",
  session_revoked: "revoked",
};

export function sessionEndReasonFromCode(
  errorCode: string | null | undefined,
): SessionEndReason | null {
  if (!errorCode) return null;
  return CODE_TO_REASON[errorCode] ?? null;
}

/** Dùng cho giá trị đọc từ query string (?reason=) — không tin thẳng. */
export function parseSessionEndReason(value: unknown): SessionEndReason | null {
  return value === "replaced" || value === "revoked" ? value : null;
}

export const SESSION_END_MESSAGES: Record<SessionEndReason, string> = {
  replaced:
    "Tài khoản này vừa được đăng nhập ở một thiết bị khác. Vì lý do bảo mật, phiên hiện tại đã kết thúc.",
  revoked:
    "Phiên đăng nhập đã kết thúc (có thể do bạn vừa đăng xuất hoặc đổi mật khẩu ở nơi khác) — vui lòng đăng nhập lại.",
};

/** URL trang đăng nhập kèm lý do (và trang định quay lại nếu có). `next`
 *  phải là path đã qua safeInternalPath() — hàm này không tự kiểm tra. */
export function loginUrl(opts: { reason?: SessionEndReason | null; next?: string | null }): string {
  const params = new URLSearchParams();
  if (opts.next) params.set("next", opts.next);
  if (opts.reason) params.set("reason", opts.reason);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}
