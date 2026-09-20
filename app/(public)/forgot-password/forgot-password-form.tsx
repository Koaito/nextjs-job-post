"use client";
// app/(public)/forgot-password/forgot-password-form.tsx
//
// QUAN TRỌNG (Nhóm 0 của plan — chống email enumeration): sau khi
// submit, form CHỈ hiện đúng 1 message chung chung (state.message),
// KHÔNG BAO GIỜ tách nhánh hiển thị "email tồn tại" / "email không tồn
// tại". state.error chỉ xuất hiện khi bản thân request thất bại (mất
// mạng, backend sập, rate-limit) — không liên quan gì tới việc email
// có tồn tại hay không.

import { useActionState } from "react";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/lib/actions/auth-actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  // Sau khi có message thành công, ẩn form đi — không cho submit lặp
  // lại vô ích (đã có rate-limit 3/hour/IP ở backend, nhưng ẩn form
  // giúp người dùng không bấm thêm gây hiểu nhầm "chưa gửi được").
  if (state.message) {
    return (
      <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
      </button>
    </form>
  );
}
