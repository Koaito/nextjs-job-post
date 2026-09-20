// app/(public)/forgot-password/page.tsx
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.is_staff ? "/dashboard" : "/jobs");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-semibold">Quên mật khẩu</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu nếu
          tài khoản tồn tại.
        </p>

        <ForgotPasswordForm />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nhớ ra mật khẩu rồi?{" "}
          <a href="/login" className="underline">
            Quay lại đăng nhập
          </a>
        </p>
      </div>
    </div>
  );
}
