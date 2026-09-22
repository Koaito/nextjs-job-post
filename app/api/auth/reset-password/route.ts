// app/api/auth/reset-password/route.ts
// BFF đặt mật khẩu mới bằng token từ email. Chuyển từ Server Action
// sang Route Handler theo plan (Phần 2 mục 1). Khớp reset_password()
// bên backend: token dùng đúng 1 lần, sai/hết hạn phân biệt qua
// `error_code` (AUTH_INVALID/AUTH_EXPIRED — Phụ lục D, không suy luận
// từ message). Thành công thì backend đã tự thu hồi toàn bộ refresh
// token + clear active_session_id của user đó — Route Handler này
// không cần tự làm gì thêm ngoài báo thành công (không tự đăng nhập
// lại, người dùng phải nhập mật khẩu mới ở /login).

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin } from "@/lib/verify-origin";

const BASE_URL = process.env.CRAWLER_API_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

export async function POST(req: NextRequest) {
  const originCheck = verifyOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const newPassword = String(body?.new_password ?? "");
  const confirmPassword = String(body?.new_password_confirm ?? "");

  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Link đặt lại mật khẩu không hợp lệ — thiếu token." },
      { status: 400 },
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Mật khẩu mới cần ít nhất 8 ký tự." },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "Mật khẩu nhập lại không khớp." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({ token, new_password: newPassword }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const detail = errBody?.detail;
      // error_code AUTH_EXPIRED / AUTH_INVALID (Phụ lục D) — hiện đúng
      // message backend trả, không tự viết lại (message đã đủ rõ +
      // hướng dẫn bước tiếp theo: xin link mới).
      const message =
        detail && typeof detail === "object" && !Array.isArray(detail)
          ? detail.message
          : null;
      return NextResponse.json(
        {
          ok: false,
          message: message ?? "Đặt lại mật khẩu thất bại, vui lòng thử lại.",
          errorCode: detail?.error_code,
        },
        { status: res.status },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Không thể kết nối tới máy chủ, vui lòng thử lại." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
