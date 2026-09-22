// app/api/auth/register/route.ts
// BFF cho đăng ký học viên. Trước 22/09 làm bằng Server Action gọi
// thẳng fetch(CRAWLER_API_URL) trong lib/actions/auth-actions.ts — lệch
// so với plan (Phần 2 mục 1, dòng 127: register phải là Route Handler
// như login/logout/refresh). Chuyển về đây, giữ NGUYÊN toàn bộ validate
// + hành vi cũ, chỉ đổi hình dạng vào/ra (JSON thay vì FormData/redirect).

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
  const fullName = String(body?.full_name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const passwordConfirm = String(body?.password_confirm ?? "");
  const phone = String(body?.phone ?? "").trim();
  const track = String(body?.track ?? "");

  // Validate lại ở server, không tin thẳng input client (Flask cũ cũng
  // check full_name/email/password rỗng, password >= 8 ký tự,
  // password_confirm khớp TRƯỚC khi gọi backend).
  if (!fullName || !email || !password) {
    return NextResponse.json(
      { ok: false, message: "Vui lòng điền đầy đủ họ tên, email và mật khẩu." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Mật khẩu cần ít nhất 8 ký tự." },
      { status: 400 },
    );
  }
  if (password !== passwordConfirm) {
    return NextResponse.json(
      { ok: false, message: "Mật khẩu nhập lại không khớp." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY! },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        phone: phone || undefined,
        track: track || undefined,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.detail?.message ?? "Đăng ký thất bại, vui lòng thử lại.";
      return NextResponse.json({ ok: false, message }, { status: res.status });
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Không thể kết nối tới máy chủ, vui lòng thử lại." },
      { status: 502 },
    );
  }

  // Thành công -> client tự redirect sang /login?registered=1&email=...
  // (giữ đúng hành vi cũ: /login đọc query này để hiện thông báo).
  return NextResponse.json({ ok: true, email });
}
