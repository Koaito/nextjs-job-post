"use client";
// components/resend-verification-form.tsx
//
// Nhánh "hết hạn" của /verify-email và show_resend ở /login dùng chung
// đúng 1 Route Handler (app/api/auth/resend-verification/route.ts) —
// viết thành 1 component nhỏ dùng lại ở cả 2 nơi thay vì viết trùng
// logic resend 2 lần (Nhóm 0 của plan). 22/09: đổi từ gọi Server Action
// (resendVerificationAction) sang fetch Route Handler, khớp quyết định
// chuyển toàn bộ auth sang kiến trúc Route Handler.

import { useState } from "react";

export function ResendVerificationForm({
  email: knownEmail,
}: {
  // Có sẵn (gọi từ /login, nơi email đã gõ trong form đăng nhập) ->
  // chỉ hiện nút bấm, gửi thẳng email đó, không hiện lại ô nhập.
  // Không có (gọi từ /verify-email?status=expired, nơi KHÔNG có cách
  // nào biết email của người vừa bấm link hết hạn) -> hiện thêm ô nhập.
  email?: string;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = knownEmail ?? emailInput;
    setIsPending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message);
    } finally {
      setIsPending(false);
    }
  }

  if (message) {
    return <p className="text-sm text-green-800">{message}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {knownEmail ? (
        <button
          type="submit"
          disabled={isPending}
          className="underline disabled:opacity-50"
        >
          {isPending ? "Đang gửi..." : "Gửi lại email xác thực"}
        </button>
      ) : (
        <>
          <div>
            <label
              htmlFor="resend-email"
              className="mb-1 block text-sm font-medium"
            >
              Email
            </label>
            <input
              id="resend-email"
              name="email"
              type="email"
              required
              autoFocus
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Đang gửi..." : "Gửi lại email xác thực"}
          </button>
        </>
      )}
    </form>
  );
}
