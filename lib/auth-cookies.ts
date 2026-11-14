// lib/auth-cookies.ts
// Hằng số + hàm thuần về cookie phiên, dùng chung giữa lib/session.ts (Node
// runtime, cookies() của next/headers) và proxy.ts (NextRequest/NextResponse.cookies).
// Tách riêng khỏi lib/session.ts vì file đó import "next/headers", mà proxy.ts
// không import được next/headers.
//
// Mục 3 (session mờ lưu DB), Pha B: chỉ còn MỘT cookie, chứa session token
// ngẫu nhiên do backend cấp (không phải JWT, không mang thông tin gì). Hai
// cookie cũ mx_access/mx_refresh bị gỡ; proxy.ts dọn chúng khi gặp (xem
// LEGACY_COOKIES). Không đặt email/role vào cookie để "đỡ một lần gọi DB":
// làm vậy mất khả năng thu hồi tức thì.

export const SESSION_COOKIE = "mx_session";

/** Cookie của cơ chế JWT + refresh cũ. Không còn được ghi hay đọc; proxy.ts chỉ xoá
 *  chúng khỏi trình duyệt người dùng đã đăng nhập từ trước Pha B. Gỡ hằng này ở Pha C
 *  khi không còn cookie cũ nào (tối đa 30 ngày sau Pha B, bằng hạn refresh cũ). */
export const LEGACY_COOKIES = ["mx_access", "mx_refresh"] as const;

/** Hạn cookie dự phòng khi backend không trả (hoặc trả sai) session_expires_at.
 *  Khớp SESSION_ABSOLUTE_DAYS mặc định của backend (30 ngày). */
export const DEFAULT_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export const COOKIE_OPTS = {
  httpOnly: true,
  // Trình duyệt coi localhost là ngữ cảnh an toàn nên dev (http://localhost) vẫn nhận cookie secure.
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * maxAge (giây) cho cookie phiên, bằng đúng hạn TUYỆT ĐỐI của phiên ở backend
 * (`session_expires_at`, chuỗi ISO 8601). Hạn trượt (nhàn rỗi) do backend giữ, cookie
 * không cần biết: phiên chết sớm thì backend trả 401 và cookie bị dọn ở lần sau.
 *
 * Thiếu / không phải ngày hợp lệ -> DEFAULT_SESSION_MAX_AGE. Hạn đã qua hoặc còn
 * dưới 1 giây -> 1 (không trả 0 hay số âm: maxAge 0 sẽ XOÁ cookie và đăng nhập
 * "thành công" mà không có phiên nào).
 */
export function sessionCookieMaxAge(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (typeof expiresAt !== "string" || expiresAt === "") return DEFAULT_SESSION_MAX_AGE;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return DEFAULT_SESSION_MAX_AGE;
  return Math.max(1, Math.floor((expiresMs - nowMs) / 1000));
}
