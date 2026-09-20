// lib/auth-guard.ts
// Thay login_required/staff_required/admin_required (decorator Flask).
// Next.js không có decorator cho route -> dùng helper gọi ở đầu Server
// Component, ném redirect nếu không đủ điều kiện. (Phần 2 mục 4)

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import type { BackendUser } from "@/lib/api/types-manual";

/**
 * Chỉ chấp nhận path NỘI BỘ: bắt đầu bằng "/" và KHÔNG bắt đầu bằng "//"
 * (loại protocol-relative URL kiểu "//evil.com") và không chứa "\\"
 * (một số trình duyệt cũ tự đổi backslash thành forward slash trước khi
 * điều hướng). Đây là cách chặn open-redirect phổ biến — dùng cho MỌI
 * nơi trong hệ thống nhận URL đích từ query string rồi tự redirect tới
 * đó, không chỉ requireUser(). Vá lại lỗ hổng open-redirect có thật ở
 * bản Flask hiện tại (blueprints/auth.py::login() đọc "next" từ query
 * string rồi redirect thẳng, không kiểm tra gì).
 */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  return path;
}

async function currentPath(): Promise<string> {
  const h = await headers();
  // Next.js không có API chính thức lấy pathname trong Server Component
  // ngoài middleware -> dựa vào header x-invoke-path nếu middleware có
  // set (xem middleware.ts), hoặc x-pathname nếu dự án tự set qua rewrite.
  // Nếu không có gì, trả rỗng — requireUser() khi đó sẽ redirect /login
  // không kèm ?next=, vẫn an toàn chỉ là không quay lại đúng trang.
  return h.get("x-invoke-path") ?? h.get("x-pathname") ?? "";
}

export async function requireUser(): Promise<BackendUser> {
  const user = await getCurrentUser();
  if (!user) {
    const path = await currentPath();
    const next = safeInternalPath(path);
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

export async function requireStaff(): Promise<BackendUser> {
  const user = await requireUser();
  if (!user.is_staff) notFound(); // khớp hành vi Flask: 403 -> trang lỗi chung

  // Khớp nhánh must_change_password trong staff_required() (Flask): nếu
  // tài khoản staff đang bị ép đổi mật khẩu lần đầu, chặn MỌI route trừ
  // chính trang đổi mật khẩu và logout.
  const path = await currentPath();
  const EXEMPT_PATHS = ["/profile/security", "/logout"];
  if (user.must_change_password && !EXEMPT_PATHS.some((p) => path.startsWith(p))) {
    redirect("/profile/security");
  }

  return user;
}

export async function requireAdmin(): Promise<BackendUser> {
  // Khớp admin_required() (Flask) — CHẶT HƠN requireStaff(), bọc lại
  // requireStaff() (không viết trùng check is_authenticated/
  // must_change_password), chỉ thêm điều kiện role === "admin".
  //
  // Phạm vi thật cần requireAdmin() (đã grep toàn bộ blueprints/*.py
  // trong plan, 6 route, xem Phần 2 mục 4):
  //   - POST /crawl/trigger, /crawl/batch/trigger,
  //     /crawl/maintenance/<job_type>/trigger
  //   - POST /staff-accounts/add, /staff-accounts/<id>/role,
  //     /staff-accounts/<id>/active-status
  const user = await requireStaff();
  if (user.role !== "admin") notFound();
  return user;
}
