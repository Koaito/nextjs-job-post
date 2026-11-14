// proxy.ts
// (Đổi tên từ middleware.ts theo Next.js 16: hàm export đổi tên middleware -> proxy.
// Proxy chạy Node.js runtime, KHÔNG còn là Edge.)
//
// Mục 3 (session mờ lưu DB), Pha B: proxy KHÔNG còn refresh token và KHÔNG gọi backend.
// Bản cũ (237 dòng) tự gọi /auth/refresh để ghi cookie mới trước mỗi render; session token
// không hết hạn theo phút và không xoay vòng nên toàn bộ phần đó bỏ. Proxy chỉ còn 3 việc:
//
//   1. Chặn SỚM route cần đăng nhập khi hoàn toàn thiếu cookie phiên (redirect /login?next=).
//      Chỉ kiểm cookie CÓ MẶT, không kiểm hợp lệ: hợp lệ hay không do backend quyết định khi
//      Server Component gọi (requireUser -> getSessionState). Cookie chết thì requireUser
//      redirect /login kèm ?reason= (nếu là session_replaced/session_revoked).
//   2. Gắn header `x-invoke-path` để lib/auth-guard.ts biết pathname hiện tại.
//   3. Xoá 2 cookie cũ mx_access/mx_refresh nếu trình duyệt còn giữ (người dùng đăng nhập từ
//      trước Pha B). Không tốn lời gọi mạng. Gỡ việc này ở Pha C.
//
// Route công khai KHÔNG bao giờ bị redirect: /jobs, /jobs/[id] vẫn gọi getSessionState() ở
// layout để hiện nút "Thêm job"/"Lưu job" cho khách đã đăng nhập; khách thì chỉ là không có cookie.

import { NextRequest, NextResponse } from "next/server";
import { loginUrl } from "@/lib/session-end";
import { LEGACY_COOKIES, SESSION_COOKIE } from "@/lib/auth-cookies";
import { isPublicPath } from "@/lib/public-routes";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const staleCookies = LEGACY_COOKIES.filter((name) => req.cookies.has(name));

  let response: NextResponse;
  if (!isPublicPath(pathname) && !hasSession) {
    // `next` là pathname do chính proxy đọc từ request, không phải giá trị người dùng gõ vào
    // query string; /login vẫn kiểm lại bằng safeInternalPath() trước khi dùng.
    response = NextResponse.redirect(new URL(loginUrl({ next: pathname }), req.url));
  } else {
    // Header đi vào request của Server Component phía sau (auth-guard đọc lại pathname).
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-invoke-path", pathname);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  for (const name of staleCookies) response.cookies.delete(name);
  return response;
}

export const config = {
  matcher: [
    // Áp dụng cho mọi route trừ static file, ảnh, favicon, API Route
    // Handler nội bộ của Next.js (_next/*) — API auth tự lo phần xác
    // thực riêng, không cần proxy can thiệp.
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
