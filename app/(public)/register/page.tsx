// app/(public)/register/page.tsx
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/jobs"); // khớp Flask: register() luôn redirect về jobs.index nếu đã login
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-2xl font-semibold">Đăng ký</h1>
        <RegisterForm />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <a href="/login" className="underline">
            Đăng nhập
          </a>
        </p>
      </div>
    </div>
  );
}
