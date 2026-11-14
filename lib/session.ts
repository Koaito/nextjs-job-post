// lib/session.ts
// Phiên đăng nhập phía Next.js (Mục 3, Pha B): MỘT cookie httpOnly chứa session
// token mờ do backend cấp (lib/auth-cookies.ts). Không còn access/refresh token,
// không còn refresh chủ động hay phản ứng, không còn React.cache() để dedupe refresh:
// token không xoay vòng nên nhiều request/tab song song dùng chung một token là an toàn.
// ĐỪNG thêm lại bất kỳ cơ chế xoay token nào "cho chắc" (roadmap 5.5).
//
// File này đụng next/headers nên CHỈ dùng trong Server Component / Route Handler /
// Server Action. proxy.ts không import nó (dùng lib/auth-cookies.ts).

import { cookies } from "next/headers";
import { getMe, type BackendUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { sessionEndReasonFromCode, type SessionEndReason } from "@/lib/session-end";
import { COOKIE_OPTS, SESSION_COOKIE, sessionCookieMaxAge } from "@/lib/auth-cookies";

/** Session token trong cookie, hoặc null nếu chưa đăng nhập. Chỉ ĐỌC cookie, không hỏi
 *  backend: token có còn hợp lệ hay không do backend quyết định ở request kế tiếp. */
export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Ghi cookie phiên. Chỉ gọi được trong Route Handler / Server Action (Server Component
 *  không được set cookie). `expiresAt` là `session_expires_at` của /auth/login. */
export async function setSessionCookie(token: string, expiresAt?: string | null) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...COOKIE_OPTS, maxAge: sessionCookieMaxAge(expiresAt) });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Trạng thái phiên của request hiện tại: người dùng (nếu còn hợp lệ) và, khi không còn,
 * LÝ DO nếu là loại cần báo cho người dùng biết (Phụ lục C: bị đăng nhập nơi khác thay /
 * phiên bị thu hồi do đăng xuất-đổi mật khẩu). Hết hạn thường hoặc chưa đăng nhập ->
 * endReason = null (im lặng).
 *
 * Mọi lỗi từ /auth/me (401 phiên chết, 403 tài khoản bị khoá, 429, 5xx, mạng) đều cho
 * user = null; chỉ error_code của nhóm "phiên kết thúc" mới thành endReason.
 *
 * Cố ý KHÔNG bọc React.cache(): sau Server Action có revalidatePath(), phần render lại
 * nằm cùng request — cache sẽ giữ thông tin người dùng cũ (vd tên vừa đổi ở /profile
 * không hiện ngay). Số lần gọi /auth/me không đổi so với trước.
 */
export async function getSessionState(): Promise<{
  user: BackendUser | null;
  endReason: SessionEndReason | null;
}> {
  const token = await getSessionToken();
  if (!token) return { user: null, endReason: null };

  try {
    return { user: await getMe(token), endReason: null };
  } catch (err) {
    return {
      user: null,
      endReason: err instanceof ApiError ? sessionEndReasonFromCode(err.errorCode) : null,
    };
  }
}

export async function getCurrentUser(): Promise<BackendUser | null> {
  return (await getSessionState()).user;
}
