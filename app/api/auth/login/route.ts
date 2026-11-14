// app/api/auth/login/route.ts
// BFF: nhận request từ browser (không cần biết CRAWLER_API_KEY), forward
// sang Scrap_JD, rồi set 1 cookie httpOnly chứa session token + trả JSON gọn cho client.
// Cặp access/refresh cũ mà backend vẫn trả (cho client cũ) bị BỎ: không lưu, không log.
// (Phần 2 mục 1 của plan)

import { NextRequest, NextResponse } from "next/server";
import { login, getMe } from "@/lib/api/auth";
import { setSessionCookie } from "@/lib/session";
import { ApiError } from "@/lib/api/client";
import { verifyOrigin } from "@/lib/verify-origin";

export async function POST(req: NextRequest) {
  const originCheck = verifyOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Thiếu email hoặc mật khẩu." },
      { status: 400 },
    );
  }

  try {
    const session = await login(email, password);
    // getMe TRƯỚC khi ghi cookie: nếu token vừa nhận bị từ chối thì không để lại cookie rác.
    const user = await getMe(session.sessionToken);
    await setSessionCookie(session.sessionToken, session.sessionExpiresAt);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { ok: false, message: err.message, errorCode: err.errorCode },
        { status: err.status ?? 400 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "Lỗi không xác định." },
      { status: 500 },
    );
  }
}
