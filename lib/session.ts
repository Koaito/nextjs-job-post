// lib/session.ts
// Tương đương _auth_tokens_from_session + load_user() bên Flask.
//
// Khác Flask (1 cookie session ký server-side chứa cả access + refresh
// token), ở đây tách thành 2 cookie httpOnly riêng — không dùng
// NEXT_PUBLIC_* hay localStorage cho 2 token này (xem Phần 2 mục 1).

import { cache } from "react";
import { cookies } from "next/headers";
import { getMe, refresh as refreshApi } from "@/lib/api/auth";
import type { BackendUser } from "@/lib/api/types-manual";

const ACCESS_COOKIE = "mx_access";
const REFRESH_COOKIE = "mx_refresh";

const ACCESS_MAX_AGE = 30 * 60; // 30 phút, khớp access token JWT
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 ngày, khớp refresh token

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function getTokens() {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: jar.get(REFRESH_COOKIE)?.value ?? null,
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, { ...COOKIE_OPTS, maxAge: ACCESS_MAX_AGE });
  jar.set(REFRESH_COOKIE, refreshToken, { ...COOKIE_OPTS, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Giải mã phần payload của JWT (KHÔNG verify chữ ký — chỉ đọc `exp` để
 *  quyết định có cần refresh hay chưa; việc verify thật do backend làm
 *  khi request thật sự được gửi lên). */
function decodeJwtExp(token: string): number | null {
  try {
    const payloadB64 = token.split(".")[1];
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Coi là "sắp hết hạn" nếu còn dưới 30 giây — chừa khoảng đệm cho thời
 *  gian request thật sự chạy tới lúc backend nhận được. */
function isExpiredSoon(token: string): boolean {
  const exp = decodeJwtExp(token);
  if (exp === null) return true; // không đọc được exp -> coi như hết hạn, an toàn hơn
  const nowSeconds = Date.now() / 1000;
  return exp - nowSeconds < 30;
}

/**
 * Trả về 1 access token CÒN DÙNG ĐƯỢC — tự refresh nếu access token đã
 * hết hạn (hoặc sắp hết), nhưng CHỈ gọi /auth/refresh ĐÚNG 1 LẦN cho mỗi
 * lần render trang nhờ bọc bằng React.cache() (Next.js tự dedupe các
 * lệnh gọi hàm giống nhau trong cùng 1 request).
 *
 * Đây là hàm DUY NHẤT trong toàn bộ app xử lý việc refresh chủ động —
 * cả getCurrentUser() lẫn callAuthed() (lib/api/client.ts) đều gọi qua
 * đây. KHÔNG được tự viết thêm 1 bản refresh riêng ở nơi khác.
 *
 * Lý do bắt buộc dedupe bằng cache() ngay từ đầu: backend Scrap_JD coi
 * refresh token là dùng 1 LẦN. Nếu 2 lệnh gọi API cần refresh xảy ra
 * cùng lúc trong cùng 1 lần render (ví dụ layout gọi song song
 * getCurrentUser() + getSavedJobIds() + getUnreadCount()), mà không
 * dedupe, lệnh thứ 2 sẽ gửi lên 1 refresh token đã bị lệnh thứ 1 làm
 * mất hiệu lực -> backend hiểu nhầm là token bị đánh cắp -> đăng xuất
 * TOÀN BỘ tài khoản trên mọi thiết bị. Xem đầy đủ ở Phụ lục A của plan.
 */
export const getValidAccessToken = cache(async (): Promise<string | null> => {
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken) return null;
  if (!isExpiredSoon(accessToken)) return accessToken;
  if (!refreshToken) return null;

  try {
    const pair = await refreshApi(refreshToken);
    await setAuthCookies(pair.access_token, pair.refresh_token);
    return pair.access_token;
  } catch {
    // Refresh thất bại (hết hạn/đã bị thu hồi/không hợp lệ) -> dọn
    // cookie, trả null. Nơi gọi (getCurrentUser/callAuthed) tự quyết
    // định bước tiếp theo (redirect lặng lẽ hay toast rõ ràng theo
    // error_code cụ thể — xem Phụ lục C).
    await clearAuthCookies();
    return null;
  }
});

/**
 * Refresh PHẢN ỨNG — dùng trong callAuthed() khi vẫn dính 401 sau khi
 * đã gọi getValidAccessToken() (lệch giờ, token bị thu hồi ngoài dự
 * kiến, hoặc trúng đúng khoảnh khắc hết hạn). KHÔNG dùng cache() ở đây
 * vì đây vốn đã là nhánh dự phòng hiếm khi chạy, không cần dedupe thêm
 * — nhưng lưu ý: nếu forceRefreshAccessToken() được gọi nhiều lần
 * trong cùng 1 request (nhiều lệnh cùng 401 cùng lúc), mỗi lần gọi vẫn
 * tự gửi request /auth/refresh riêng, có thể trúng đúng race condition
 * ở Phụ lục A. Ở mức migrate đầu, chấp nhận rủi ro này cho nhánh phản
 * ứng (xác suất thấp hơn nhiều so với nhánh chủ động), theo đúng
 * hướng A đã chốt trong Phụ lục A — không thêm Redis lock.
 */
export async function forceRefreshAccessToken(): Promise<string | null> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) return null;

  try {
    const pair = await refreshApi(refreshToken);
    await setAuthCookies(pair.access_token, pair.refresh_token);
    return pair.access_token;
  } catch {
    await clearAuthCookies();
    return null;
  }
}

export async function getCurrentUser(): Promise<BackendUser | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  try {
    return await getMe(accessToken);
  } catch {
    return null;
  }
}
