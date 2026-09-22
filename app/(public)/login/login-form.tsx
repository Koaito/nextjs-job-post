"use client";
// app/(public)/login/login-form.tsx
//
// 22/09: viết lại từ Server Action (useActionState + loginAction) sang
// gọi thẳng Route Handler app/api/auth/login/route.ts qua fetch — Route
// Handler này đã có sẵn đúng theo plan (Phần 2 mục 1) từ trước nhưng
// chưa ai gọi tới. Quyết định chốt cùng đợt rà lại 4 mục checklist: mọi
// route auth cần set cookie phiên đều đi qua Route Handler, không dùng
// Server Action, để nhất quán 1 kiến trúc cho toàn bộ Nhóm 0.
//
// `nextPath` đã được /login/page.tsx validate qua safeInternalPath()
// ở phía server TRƯỚC khi truyền xuống đây (chặn open-redirect) — form
// này chỉ việc gửi thẳng lên, không tự validate lại.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResendVerificationForm } from "@/components/resend-verification-form";

export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setIsPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.message ?? "Đăng nhập thất bại, vui lòng thử lại.");
        // Khớp show_resend ở Flask: chỉ hiện khi lỗi là email chưa xác
        // thực (error_code, không dò theo nội dung message — Phụ lục D).
        setShowResend(data.errorCode === "auth_email_not_verified");
        setIsPending(false);
        return;
      }

      const user = data.user;
      // Khớp blueprints/auth.py::login() bên Flask, đã vá lỗ hổng
      // open-redirect: staff phải đổi mật khẩu lần đầu -> ưu tiên cao
      // nhất, sau đó mới tới ?next=, cuối cùng mới về trang mặc định
      // theo role.
      if (user.is_staff && user.must_change_password) {
        router.push("/profile/security");
      } else if (nextPath) {
        router.push(nextPath);
      } else {
        router.push(user.is_staff ? "/dashboard" : "/jobs");
      }
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{error}</p>

          {showResend && (
            <div className="mt-2">
              <ResendVerificationForm email={email} />
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
