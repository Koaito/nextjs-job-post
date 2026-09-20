"use client";
// app/(public)/login/login-form.tsx
// Client Component vì cần useActionState để hiện lỗi/showResend từ
// Server Action mà không mất input người dùng đã gõ.

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/lib/actions/auth-actions";
import { ResendVerificationForm } from "@/components/resend-verification-form";

const initialState: AuthActionState = {};

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {nextPath && <input type="hidden" name="next" value={nextPath} />}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={state.resendEmail ?? ""}
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
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>{state.error}</p>

          {/* Khớp show_resend ở Flask: chỉ hiện khi lỗi là email chưa
              xác thực (error_code === "email_not_verified"), không dò
              theo nội dung message (Phụ lục D của plan). Dùng chung
              component với nhánh "hết hạn" của /verify-email. */}
          {state.showResend && (
            <div className="mt-2">
              <ResendVerificationForm email={state.resendEmail} />
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
