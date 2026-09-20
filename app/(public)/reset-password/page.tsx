// app/(public)/reset-password/page.tsx
//
// Route này nhận `?token=` từ link trong email (POST /auth/forgot-password
// -> send_password_reset_email() dựng link trỏ thẳng vào trang này, khác
// GET /auth/verify-email trỏ thẳng vào backend rồi mới redirect về
// frontend — 2 luồng khác nhau, xem api/routers/auth_registration.py).
// Token hết hạn sau 1h; hết hạn/sai thì để nguyên báo lỗi tại chỗ khi
// submit (error_code AUTH_EXPIRED/AUTH_INVALID), không tự đoán trước
// khi người dùng bấm submit vì route GET này không có cách nào tự kiểm
// tra token còn hợp lệ hay không mà không "tiêu" nó.
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.is_staff ? "/dashboard" : "/jobs");
  }

  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold">Đặt lại mật khẩu</h1>

        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="space-y-4">
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              Link không hợp lệ — thiếu token. Vui lòng dùng đúng link đã
              nhận trong email.
            </p>
            <a
              href="/forgot-password"
              className="block text-center text-sm underline"
            >
              Xin link đặt lại mật khẩu mới
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
