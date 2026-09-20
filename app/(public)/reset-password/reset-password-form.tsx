"use client";
// app/(public)/reset-password/reset-password-form.tsx

import { useActionState } from "react";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/lib/actions/auth-actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  // Thành công: backend đã tự thu hồi toàn bộ refresh token + clear
  // active_session_id (single-session) của user đó — không tự đăng
  // nhập lại ở đây, bắt người dùng chủ động nhập mật khẩu MỚI ở /login
  // để chắc chắn họ nhớ đúng mật khẩu vừa đổi.
  if (state.success) {
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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

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
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <div className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{state.error}</p>
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
