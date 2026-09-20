// app/api/auth/logout/route.ts
// Gọi POST /auth/logout ở backend (xoá active_session_id -> mọi access
// token đang có hiệu lực bị chặn ngay từ request kế tiếp, xem Phụ lục
// C), rồi xoá 2 cookie phiên. Xoá cookie kể cả khi gọi backend lỗi, để
// người dùng luôn thoát được khỏi trình duyệt hiện tại dù backend có
// vấn đề gì.

import { NextRequest, NextResponse } from "next/server";
import { logout as logoutApi } from "@/lib/api/auth";
import { clearAuthCookies } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

export async function POST(req: NextRequest) {
  const originCheck = verifyOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "Yêu cầu không hợp lệ." },
      { status: 403 },
    );
  }

  try {
    await logoutApi();
  } catch {
    // Không chặn logout phía client dù gọi backend thất bại — vẫn xoá
    // cookie bên dưới để người dùng luôn thoát được.
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
