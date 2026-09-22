"use client";
// app/(public)/reset-password/reset-password-form.tsx
// 22/09: đổi từ Server Action (resetPasswordAction) sang gọi Route
// Handler app/api/auth/reset-password/route.ts qua fetch.

import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          new_password_confirm: confirmPassword,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.message ?? "Đặt lại mật khẩu thất bại, vui lòng thử lại.");
        setIsPending(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
      setIsPending(false);
    }
  }

  // Thành công: backend đã tự thu hồi toàn bộ refresh token + clear
  // active_session_id (single-session) của user đó — không tự đăng
  // nhập lại ở đây, bắt người dùng chủ động nhập mật khẩu MỚI ở /login
  // để chắc chắn họ nhớ đúng mật khẩu vừa đổi.
  if (success) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Đặt lại mật khẩu thành công — vui lòng đăng nhập lại bằng mật khẩu
          mới.
        </p>
        <a
          href="/login"
          className="block w-full rounded-md bg-black px-3 py-2 text-center text-sm font-medium text-white"
        >
          Về trang đăng nhập
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new_password" className="mb-1 block text-sm font-medium">
          Mật khẩu mới
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="new_password_confirm"
          className="mb-1 block text-sm font-medium"
        >
          Nhập lại mật khẩu mới
        </label>
        <input
          id="new_password_confirm"
          name="new_password_confirm"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{error}</p>
          {/* Token hết hạn/sai (AUTH_EXPIRED, AUTH_INVALID) không tự
              sửa được bằng cách submit lại form này — luôn cần link mới
              từ /forgot-password, nên gợi ý ngay tại chỗ báo lỗi. */}
          <a href="/forgot-password" className="underline">
            Xin link đặt lại mật khẩu mới
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </button>
    </form>
  );
}
