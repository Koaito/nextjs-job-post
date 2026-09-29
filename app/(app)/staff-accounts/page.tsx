// app/(app)/staff-accounts/page.tsx
// Tương đương staff_accounts.html + blueprints/staff.py::accounts() (Flask)
// — "Tài khoản team SS". Nhóm 3, Đợt 3.2, LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/4 — khung trang + bảng + lọc (CHỈ XEM, file này)
//   [ ] Phần 2/4 — /staff-accounts/add (tạo tài khoản, admin-only)
//   [ ] Phần 3/4 — đổi role (admin-only)
//   [ ] Phần 4/4 — khoá/mở tài khoản (admin-only)
//
// CHỈ STAFF (staff_required bên Flask): requireStaff() — ss_team xem được,
// KHÔNG chỉ admin (3 hành động mutate mới cần requireAdmin(), làm ở Phần
// 2-4). force-dynamic: trạng thái tài khoản (is_active/role) ảnh hưởng
// trực tiếp tới việc đăng nhập được hay không, cần luôn thấy số liệu mới
// nhất khi vào trang, không dựa vào cache trang cũ.

import { requireStaff } from "@/lib/auth-guard";
import { listAllUsers } from "@/lib/api/auth";
import { StaffAccountsTable } from "./staff-accounts-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tài khoản team SS — MindX Career Hub",
};

export default async function StaffAccountsPage() {
  await requireStaff();

  let users: Awaited<ReturnType<typeof listAllUsers>> = [];
  let error: string | null = null;
  try {
    users = await listAllUsers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải danh sách tài khoản.";
  }

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Tài khoản team SS</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Danh sách toàn bộ tài khoản đăng nhập qua backend (gồm cả học viên tự đăng ký).
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <StaffAccountsTable users={users} />
      )}
    </div>
  );
}
