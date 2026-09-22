"use client";
// app/(public)/forgot-password/forgot-password-form.tsx
//
// QUAN TRỌNG (Nhóm 0 của plan — chống email enumeration): sau khi
// submit, form CHỈ hiện đúng 1 message chung chung, KHÔNG BAO GIỜ tách
// nhánh hiển thị "email tồn tại" / "email không tồn tại". `error` chỉ
// xuất hiện khi bản thân request thất bại (mất mạng, backend sập,
// rate-limit) — không liên quan gì tới việc email có tồn tại hay không.
//
// 22/09: đổi từ Server Action (forgotPasswordAction) sang gọi Route
// Handler app/api/auth/forgot-password/route.ts qua fetch.

import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.message ?? "Không thể gửi yêu cầu lúc này, vui lòng thử lại.");
        setIsPending(false);
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Không thể kết nối tới máy chủ, vui lòng thử lại.");
      setIsPending(false);
    }
  }

  // Sau khi có message thành công, ẩn form đi — không cho submit lặp
  // lại vô ích (đã có rate-limit 3/hour/IP ở backend, nhưng ẩn form
  // giúp người dùng không bấm thêm gây hiểu nhầm "chưa gửi được").
  if (message) {
    return (
      <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {message}
      </div>
    );
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
        {isPending ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
      </button>
    </form>
  );
}
