// lib/session-end-client.ts
// Xử lý phía TRÌNH DUYỆT khi biết phiên đã kết thúc (Phụ lục C). Dùng chung
// cho mọi nơi client tự phát hiện: polling (badge, khung chat), listener ở
// layout, tín hiệu từ tab khác.
//
// Cách làm: báo các tab khác -> xoá cookie phiên (qua route logout, chạy
// được kể cả khi backend đã từ chối phiên) -> điều hướng cứng sang /login kèm
// ?reason=. Message hiện bằng banner ở trang /login, KHÔNG dùng toast: Toaster
// nằm trong layout (app), sang /login (nhóm public) là unmount nên toast sẽ
// biến mất ngay khi chuyển trang.

import { broadcastSessionEnded } from "@/lib/auth-channel";
import { loginUrl, sessionEndReasonFromCode, type SessionEndReason } from "@/lib/session-end";

let handled = false;

/** Xoá 2 cookie phiên. Lỗi mạng bị nuốt: việc xoá cookie là nỗ lực tốt nhất,
 *  lần tải trang kế tiếp proxy.ts/layout vẫn tự phát hiện phiên chết. */
export async function clearSessionCookies(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    // bỏ qua
  }
}

/** Phiên đã kết thúc vì `reason` -> dọn dẹp rồi sang /login. Chỉ chạy 1 lần
 *  mỗi lần tải trang (nhiều nguồn có thể cùng phát hiện: badge, khung chat,
 *  tín hiệu tab khác...). `broadcast: false` khi chính tín hiệu này đến từ
 *  tab khác (tránh vọng qua lại giữa các tab). */
export async function handleSessionEnded(
  reason: SessionEndReason,
  opts: { broadcast?: boolean } = {},
): Promise<void> {
  if (handled) return;
  handled = true;

  if (opts.broadcast !== false) broadcastSessionEnded(reason);
  await clearSessionCookies();
  window.location.assign(loginUrl({ reason }));
}

/** Đọc `errorCode` từ body JSON lỗi của các Route Handler polling của mình
 *  ({ ok: false, errorCode }). Body không phải JSON/không có -> undefined. */
export async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const code = (body as { errorCode?: unknown }).errorCode;
      if (typeof code === "string") return code;
    }
  } catch {
    // bỏ qua
  }
  return undefined;
}

/** Gọi khi 1 request polling nhận lỗi: nếu là 401 mang error_code của loại
 *  "phiên kết thúc" (Phụ lục C) thì xử lý luôn. 401 hết hạn thường (không có
 *  error_code đó) thì không làm gì — nơi gọi vẫn tự dừng polling như cũ. */
export function endSessionIfNeeded(status: number, errorCode: string | undefined): void {
  if (status !== 401) return;
  const reason = sessionEndReasonFromCode(errorCode);
  if (reason) void handleSessionEnded(reason);
}
