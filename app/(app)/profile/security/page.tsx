// app/(app)/profile/security/page.tsx
// Tương đương profile_security.html (Flask) — "Bảo mật" (đổi mật khẩu).
// Eyebrow + tiêu đề "Trang cá nhân" + sub-nav nằm ở profile/layout.tsx
// (Nhóm 5, Đợt 5.1); file này chỉ còn phần thân. requireUser() vẫn gọi ở
// đây: layout không chạy lại khi chuyển tab nên không thể là guard duy nhất.

import { requireUser } from "@/lib/auth-guard";
import { ChangePasswordForm } from "./change-password-form";

export default async function ProfileSecurityPage() {
  const user = await requireUser();

  return (
    <div className="max-w-md space-y-6">
      <p className="text-muted-foreground">
        {user.must_change_password
          ? "Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được admin reset) — vui lòng đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống."
          : "Nhập mật khẩu hiện tại và mật khẩu mới bên dưới."}
      </p>
      <ChangePasswordForm mustChangePassword={user.must_change_password} />
      <p className="text-sm text-muted-foreground">
        Đổi xong hệ thống sẽ đăng xuất và yêu cầu bạn đăng nhập lại bằng mật khẩu mới.
      </p>
    </div>
  );
}
