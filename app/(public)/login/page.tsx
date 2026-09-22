// app/(public)/login/page.tsx
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth-guard";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string; email?: string }>;
}) {
  // Khớp Flask: if current_user.is_authenticated -> redirect theo role
  const user = await getCurrentUser();
  if (user) {
    redirect(user.is_staff ? "/dashboard" : "/jobs");
  }

  const params = await searchParams;
  // 22/09: LoginForm giờ là Client Component gọi fetch trực tiếp (xem
  // login-form.tsx), không còn qua Server Action nơi safeInternalPath()
  // từng được gọi (loginAction cũ) -> validate ngay tại đây, ở Server
  // Component, TRƯỚC khi đưa "next" xuống client. Vẫn cùng 1 hàm
  // safeInternalPath() dùng ở requireUser() (Phần 2 mục 4 của plan),
  // không viết thêm 1 bản chặn open-redirect riêng.
  const nextPath = safeInternalPath(params.next);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold">Đăng nhập</h1>

        {params.registered === "1" && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Đã tạo tài khoản{params.email ? ` cho ${params.email}` : ""}. Vui
            lòng kiểm tra email và bấm vào link xác thực trước khi đăng nhập.
          </p>
        )}

        <LoginForm nextPath={nextPath} />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{" "}
          <a href="/register" className="underline">
            Đăng ký
          </a>
        </p>
      </div>
    </div>
  );
}
