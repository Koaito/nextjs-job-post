// lib/api/auth.ts
// Các hàm gọi thẳng route /auth/* của Scrap_JD.
//
// LƯU Ý: login() và refresh() KHÔNG đi qua callAuthed() (vì bản thân
// chúng là nơi LẤY token, không phải nơi CẦN token có sẵn) — 2 hàm này
// dùng thẳng fetch để tránh vòng lặp phụ thuộc với lib/session.ts.

import type { BackendUser, TokenPair } from "@/lib/api/types-manual";
import { ApiError, callAuthed } from "@/lib/api/client";

const BASE_URL = process.env.CRAWLER_API_URL;
const API_KEY = process.env.CRAWLER_API_KEY;

async function authRawFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY!,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;

    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      throw new ApiError(
        detail.message ?? "Lỗi không xác định",
        res.status,
        detail.error_code,
        detail.params,
      );
    }
    if (Array.isArray(detail) && detail.length > 0) {
      throw new ApiError(detail[0]?.msg ?? "Dữ liệu gửi lên không hợp lệ.", res.status);
    }
    throw new ApiError("Lỗi không xác định", res.status);
  }

  return res.json();
}

export const login = (email: string, password: string) =>
  authRawFetch<TokenPair>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

/**
 * Xoay vòng refresh token — LUÔN nhận lại 1 CẶP token mới. Backend thu
 * hồi token cũ ngay khi hàm này chạy, nên hàm này KHÔNG được gọi trùng
 * lặp cho cùng 1 refresh token trong cùng 1 request (xem lib/session.ts
 * — getValidAccessToken() đã bọc React.cache() để đảm bảo điều này).
 */
export const refresh = (refreshToken: string) =>
  authRawFetch<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

/**
 * GET /auth/me — backend trả UserOut (KHÔNG có field `is_staff`, xem
 * lib/api/types-manual.ts), nên tự tính thêm ở đây trước khi trả ra
 * ngoài. Mọi nơi khác trong app (session.ts, auth-guard.ts, route
 * handlers...) dựa vào is_staff đã tính sẵn này, không tự suy lại
 * `role !== "user"` rải rác nhiều chỗ.
 */
export const getMe = async (accessToken: string): Promise<BackendUser> => {
  const user = await authRawFetch<Omit<BackendUser, "is_staff">>("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { ...user, is_staff: user.role !== "user" };
};

/**
 * PATCH /auth/me — cho user tự sửa full_name/phone/track của chính
 * mình. Backend TỰ ÉP phone/track về NULL cho mọi tài khoản không phải
 * role "user" (staff) — form Profile nên ẩn hẳn 2 field này khi user
 * hiện tại là staff, không hiện ô nhập rồi âm thầm không lưu được.
 * (Phần 2 mục 3 của plan)
 */
export const updateMe = (data: { full_name: string; phone?: string; track?: string }) =>
  callAuthed<BackendUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const logout = () => callAuthed<void>("/auth/logout", { method: "POST" });

/**
 * POST /auth/change-password — CẦN auth (đi qua callAuthed, tự refresh
 * token nếu cần). `old_password` chỉ optional khi must_change_password
 * đang true (Route Handler không tự đoán trước, để backend quyết định
 * và trả lỗi `AUTH_OLD_PASSWORD_INCORRECT` (401) nếu thiếu/sai khi thật
 * ra bắt buộc — xem api/routers/auth_session.py::change_password() bên
 * Scrap_JD). Backend tự thu hồi TOÀN BỘ refresh token + clear
 * active_session_id sau khi đổi thành công — Route Handler gọi hàm này
 * (app/api/auth/change-password/route.ts) có trách nhiệm tự xoá cookie
 * phiên NGAY sau khi gọi thành công, không đợi request kế tiếp tự phát
 * hiện phiên đã chết.
 */
export const changePassword = (data: { old_password?: string; new_password: string }) =>
  callAuthed<BackendUser>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
