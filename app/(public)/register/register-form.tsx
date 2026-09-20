"use client";
// app/(public)/register/register-form.tsx

import { useActionState } from "react";
import {
  registerAction,
  type AuthActionState,
} from "@/lib/actions/auth-actions";
import { INDUSTRIES, TRACK_OTHER } from "@/lib/constants";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);
  const v = state.values ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
          Họ và tên
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          defaultValue={v.full_name ?? ""}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={v.email ?? ""}
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
          minLength={8}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="password_confirm" className="mb-1 block text-sm font-medium">
          Nhập lại mật khẩu
        </label>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          minLength={8}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">
          Số điện thoại
        </label>
        <input
          id="phone"
          name="phone"
          type="text"
          defaultValue={v.phone ?? ""}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="track" className="mb-1 block text-sm font-medium">
          Ngành học
        </label>
        <select
          id="track"
          name="track"
          defaultValue={v.track ?? ""}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">-- Chọn ngành --</option>
          {INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
          <option value={TRACK_OTHER}>{TRACK_OTHER}</option>
        </select>
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
        {isPending ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>
    </form>
  );
}
