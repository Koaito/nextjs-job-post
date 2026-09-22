"use client";
// app/(app)/profile/security/change-password-form.tsx
//
// Field "mật khẩu hiện tại" CHỈ ẩn khi mustChangePassword === true (tài
// khoản mới tạo/vừa bị admin reset — chưa có "mật khẩu cũ của riêng
// họ" theo đúng nghĩa) — khớp checklist Nhóm 5 + logic thật ở backend
// (api/routers/auth_session.py::change_password()).
//
// Thành công -> Route Handler đã tự xoá cookie phiên (backend thu hồi
// toàn bộ refresh token + clear active_session_id) -> redirect thẳng
// /login, KHÔNG giữ phiên hiện tại (đúng yêu cầu Nhóm 5).

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm({
  mustChangePassword,
}: {
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: mustChangePassword ? undefined : oldPassword,
          new_password: newPassword,
          new_password_confirm: confirmPassword,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        // error_code AUTH_OLD_PASSWORD_INCORRECT (401) hoặc lỗi khác —
        // hiện đúng message backend trả, không tự viết lại (Phụ lục D).
        setError(data.message ?? "Đổi mật khẩu thất bại, vui lòng thử lại.");
        setIsPending(false);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!mustChangePassword && (
        <div>
          <label htmlFor="old_password" className="mb-1 block text-sm font-medium">
            Mật khẩu hiện tại
          </label>
          <input
            id="old_password"
            name="old_password"
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}

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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang lưu..." : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
