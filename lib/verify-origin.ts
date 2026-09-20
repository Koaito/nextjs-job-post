// lib/verify-origin.ts
// Thay CSRF token kiểu Flask-WTF. Cookie mx_access/mx_refresh vẫn tự
// động gửi kèm request tới domain Next.js -> vẫn có rủi ro CSRF tương
// tự Flask, không phải "vì gọi API riêng nên hết cần lo".
//
// Next.js Server Actions đã tự kiểm tra Origin header (built-in từ Next
// 14+), nhưng CHỈ áp dụng cho Server Actions, không áp dụng cho Route
// Handler gọi trực tiếp qua fetch() từ Client Component. Route Handler
// nào nhận POST/PUT/DELETE và dựa vào cookie để xác thực thì PHẢI gọi
// hàm này. (Phần 2 mục 6 của plan)

import { NextRequest } from "next/server";

export function verifyOrigin(req: NextRequest): { ok: boolean } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    // Chưa cấu hình NEXT_PUBLIC_APP_URL -> không thể verify, coi là lỗi
    // cấu hình (an toàn hơn là fail-closed thay vì fail-open).
    return { ok: false };
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const appOrigin = new URL(appUrl).origin;

  if (origin) {
    return { ok: origin === appOrigin };
  }
  if (referer) {
    try {
      return { ok: new URL(referer).origin === appOrigin };
    } catch {
      return { ok: false };
    }
  }

  // Không có cả Origin lẫn Referer (một số trình duyệt/proxy lược bỏ) ->
  // fail-closed, an toàn hơn.
  return { ok: false };
}
