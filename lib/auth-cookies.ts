// lib/auth-cookies.ts
// Hằng số tên cookie/maxAge/options dùng chung giữa lib/session.ts (Node
// runtime, dùng cookies() của next/headers) và middleware.ts (Edge
// runtime, dùng NextRequest/NextResponse.cookies) — tách riêng ra đây
// (KHÔNG đặt trong lib/session.ts) vì lib/session.ts import "next/headers"
// ở đầu module nên middleware.ts không import được nó (next/headers chỉ
// dùng được trong ngữ cảnh render Server Component/Route Handler, không
// phải middleware). Tách ra file thuần hằng số này để không phải gõ lặp
// lại tên cookie/thời hạn ở 2 nơi rồi lệch nhau dần. (Round sửa refresh —
// chat238.txt/chat239.txt)

export const ACCESS_COOKIE = "mx_access";
export const REFRESH_COOKIE = "mx_refresh";

export const ACCESS_MAX_AGE = 30 * 60; // 30 phút, khớp access token JWT
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 ngày, khớp refresh token

export const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
