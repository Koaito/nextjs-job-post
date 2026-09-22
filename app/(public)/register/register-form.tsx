"use client";
// app/(public)/register/register-form.tsx
// 22/09: đổi từ Server Action (registerAction) sang gọi Route Handler
// app/api/auth/register/route.ts qua fetch, khớp quyết định chuyển
// toàn bộ auth sang kiến trúc Route Handler.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES, TRACK_OTHER } from "@/lib/constants";

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    password: "",
    password_confirm: "",
    phone: "",
    track: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.message ?? "Đăng ký thất bại, vui lòng thử lại.");
        setIsPending(false);
        return;
      }

      // Route Handler không giữ được flash message như Flask session,
      // nên /login tự đọc ?registered=1&email=... để hiện thông báo.
      router.push(`/login?registered=1&email=${encodeURIComponent(data.email)}`);
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
          Họ và tên
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          value={values.full_name}
          onChange={(e) => update("full_name", e.target.value)}
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
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
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
          value={values.password}
          onChange={(e) => update("password", e.target.value)}
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
          value={values.password_confirm}
          onChange={(e) => update("password_confirm", e.target.value)}
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
          value={values.phone}
          onChange={(e) => update("phone", e.target.value)}
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
          value={values.track}
          onChange={(e) => update("track", e.target.value)}
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
        {isPending ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>
    </form>
  );
}
