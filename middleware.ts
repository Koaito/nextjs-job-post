// middleware.ts
// Chỉ làm 1 việc nhẹ, chạy Edge runtime: chặn sớm nếu route thuộc
// nhóm cần-login mà HOÀN TOÀN không có cookie mx_access/mx_refresh
// (redirect /login ngay, đỡ phải render Server Component rồi mới biết
// chưa đăng nhập). Việc xác thực "thật" (gọi /auth/me, tự refresh,
// check role) luôn nằm ở requireUser()/requireStaff() phía Server
// Component — tránh nhồi hết logic vào middleware vì Edge runtime
// không nên gánh nhiều I/O. (Phần 2 mục 4 của plan)

import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// Xem danh sách/chi tiết job không cần đăng nhập — đúng như Flask
// (/, /jobs, /jobs/more, /jobs/<id> không có @login_required) và là
// điều kiện để SEO (Phần 4 mục 3) hoạt động.
// KHÔNG dùng startsWith("/jobs"): sẽ vô tình mở luôn /jobs/add và
// /jobs/[id]/edit.
function isPublicJobRoute(p: string): boolean {
  if (p === "/" || p === "/jobs" || p === "/jobs/more") return true;
  if (p === "/jobs/add") return false;
  return /^\/jobs\/[^/]+$/.test(p);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Set header để lib/auth-guard.ts đọc lại pathname hiện tại trong
  // Server Component (Next.js không có API chính thức khác cho việc này).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-invoke-path", pathname);

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || isPublicJobRoute(pathname);

  if (isPublic) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasAuthCookie = req.cookies.has("mx_access") || req.cookies.has("mx_refresh");
  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Áp dụng cho mọi route trừ static file, ảnh, favicon, API Route
    // Handler nội bộ của Next.js (_next/*) — API auth tự lo phần xác
    // thực riêng, không cần middleware can thiệp.
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
