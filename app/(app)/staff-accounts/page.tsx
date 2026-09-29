// app/(app)/staff-accounts/page.tsx
// Tương đương staff_accounts.html + blueprints/staff.py::accounts() (Flask)
// — "Tài khoản team SS". Nhóm 3, Đợt 3.2, LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/4 — khung trang + bảng + lọc (CHỈ XEM, file này)
//   [x] Phần 2/4 — /staff-accounts/add (tạo tài khoản, admin-only) + nút "＋ Thêm tài khoản"
//   [x] Phần 3/4 — đổi role (admin-only, có Dialog xác nhận)
//   [x] Phần 4/4 — khoá/mở tài khoản (admin-only, Dialog xác nhận khi khoá)
//
// CHỈ STAFF (staff_required bên Flask): requireStaff() — ss_team xem được,
// KHÔNG chỉ admin (3 hành động mutate mới cần requireAdmin(), làm ở Phần
// 2-4, đã xong). force-dynamic: trạng thái tài khoản (is_active/role) ảnh hưởng
// trực tiếp tới việc đăng nhập được hay không, cần luôn thấy số liệu mới
// nhất khi vào trang, không dựa vào cache trang cũ.

import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { buttonVariants } from "@/components/ui/button";
import { listAllUsers } from "@/lib/api/auth";
import { StaffAccountsTable } from "./staff-accounts-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tài khoản team SS — MindX Career Hub",
};

export default async function StaffAccountsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "admin";

  let users: Awaited<ReturnType<typeof listAllUsers>> = [];
  let error: string | null = null;
  try {
    users = await listAllUsers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải danh sách tài khoản.";
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
          <h1 className="font-heading text-3xl font-semibold">Tài khoản team SS</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Danh sách toàn bộ tài khoản đăng nhập qua backend (gồm cả học viên tự đăng ký). Chỉ tài khoản{" "}
            <strong>admin</strong> mới tạo được tài khoản mới, đổi role hoặc khoá/mở tài khoản người khác.
          </p>
        </div>
        {isAdmin && (
          <Link href="/staff-accounts/add" className={buttonVariants()}>
            ＋ Thêm tài khoản
          </Link>
        )}
      </header>

      {!isAdmin && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Bạn đang xem ở chế độ chỉ đọc (role hiện tại: <strong>{user.role}</strong>) — chỉ tài khoản{" "}
          <strong>admin</strong> mới tạo tài khoản mới, đổi role hoặc khoá/mở tài khoản người khác.
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <StaffAccountsTable users={users} isAdmin={isAdmin} currentUserId={user.ss_user_id} />
      )}
    </div>
  );
}
