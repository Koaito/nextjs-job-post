// lib/public-routes.ts
// Route nào KHÔNG cần đăng nhập — dùng cho proxy.ts. Tách khỏi proxy.ts để test được mà
// file proxy chỉ export đúng `proxy` và `config` như Next.js yêu cầu.

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

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || isPublicJobRoute(pathname);
}
