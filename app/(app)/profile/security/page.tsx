// app/(app)/profile/security/page.tsx
//
// BẢN TỐI THIỂU (22/09) — chỉ đủ để test được luồng đổi mật khẩu ngay
// sau khi thêm Route Handler app/api/auth/change-password/route.ts.
// Phần còn lại của Nhóm 5 (`/profile`, `/profile/activity`, sub-nav
// dùng chung giữa 3 trang) VẪN CHƯA LÀM — xem checklist Nhóm 5.

import { requireUser } from "@/lib/auth-guard";
import { ChangePasswordForm } from "./change-password-form";

export default async function ProfileSecurityPage() {
  const user = await requireUser();

  return (
    <div className="max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold">Bảo mật</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {user.must_change_password
          ? "Tài khoản của bạn cần đổi mật khẩu trước khi tiếp tục."
          : "Đổi mật khẩu đăng nhập."}
      </p>
      <ChangePasswordForm mustChangePassword={user.must_change_password} />
    </div>
  );
}
