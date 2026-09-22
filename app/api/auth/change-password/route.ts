// app/api/auth/change-password/route.ts
// MỚI (22/09) — trước đó chưa có gì cả (Route Handler lẫn Server
// Action), dù ChangePasswordRequest đã có sẵn trong types.ts generate
// từ OpenAPI. Theo quyết định chốt cùng đợt rà lại 4 mục checklist:
// đồng bộ với login/logout/refresh, dùng Route Handler (không phải
// Server Action) cho MỌI route auth cần set/xoá cookie phiên.
//
// Khác 4 route auth công khai kia (register/resend/forgot/reset):
// route này CẦN đăng nhập (dựa vào cookie mx_access qua callAuthed(),
// xem lib/api/auth.ts::changePassword()) nên bắt buộc verifyOrigin().
//
// old_password chỉ optional khi must_change_password đang true (tài
// khoản mới tạo/vừa bị admin reset) — Route Handler KHÔNG tự đoán điều
// kiện này, để backend tự validate và trả lỗi
// error_code=AUTH_OLD_PASSWORD_INCORRECT (401) nếu thiếu/sai lúc thật
// ra bắt buộc (xem api/routers/auth_session.py::change_password() bên
// Scrap_JD) — đúng nguyên tắc Phụ lục D: rẽ nhánh lỗi bằng error_code,
// không tự suy luận nghiệp vụ ở tầng BFF.
//
// Đổi mật khẩu thành công -> backend đã tự thu hồi TOÀN BỘ refresh
// token + clear active_session_id (kể cả phiên hiện tại). Route Handler
// PHẢI tự xoá cookie mx_access/mx_refresh ngay tại đây (không đợi
// request kế tiếp mới phát hiện phiên đã chết) — khớp yêu cầu Nhóm 5:
// "Đổi mật khẩu thành công -> logout hoàn toàn + redirect /login,
// không giữ phiên hiện tại".

import { NextRequest, NextResponse } from "next/server";
import { changePassword } from "@/lib/api/auth";
import { clearAuthCookies } from "@/lib/session";
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
  const oldPassword = typeof body?.old_password === "string" ? body.old_password : undefined;
  const newPassword = String(body?.new_password ?? "");
  const confirmPassword = String(body?.new_password_confirm ?? "");

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
    await changePassword({ old_password: oldPassword, new_password: newPassword });
  } catch (err) {
    if (err instanceof ApiError) {
      // 401 + error_code=AUTH_OLD_PASSWORD_INCORRECT (sai/thiếu mật
      // khẩu cũ) hoặc 401 thường (phiên hết hạn hẳn, callAuthed refresh
      // phản ứng cũng thất bại) — cả 2 đều trả nguyên message/errorCode
      // backend, không tự viết lại (Phụ lục D).
      return NextResponse.json(
        { ok: false, message: err.message, errorCode: err.errorCode },
        { status: err.status ?? 400 },
      );
    }
    return NextResponse.json(
      { ok: false, message: "Lỗi không xác định, vui lòng thử lại." },
      { status: 500 },
    );
  }

  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
