// app/api/messages/since/[partnerId]/route.ts
// Route Handler cho khung chat <ChatThread> (polling qua SWR) — tương đương
// GET /messages/<partner_id>/since.json bên Flask (blueprints/messages.py::
// since_json). Nhóm 4 (Messages), Phần 2/3 nửa sau. Cùng khuôn với
// app/api/messages/unread-count/route.ts.
//
// Plan Nhóm 4 yêu cầu riêng cho route polling:
//   1. Hết phiên phải trả 401 JSON THẬT, không redirect — để fetch phía client
//      nhận đúng 401 mà dừng polling hẳn. proxy.ts đã loại /api/* khỏi
//      matcher nên không có redirect nào chen vào; ở đây chỉ cần tự trả 401.
//   2. Tự set Cache-Control: no-store trên response CỦA CHÍNH route này (header
//      backend là của lời gọi server-to-server, không tới được trình duyệt).
//
// GET chỉ ĐỌC nên KHÔNG gọi verifyOrigin() (plan Phần 2 mục 6 chỉ bắt buộc cho
// route mutation dựa vào cookie).
//
// Trả ChatMessageView[] (id, senderId, content, timeLabel) thay vì nguyên
// ChatMessageOut: không đẩy read_at/receiver_id xuống trình duyệt, và giờ đã
// được định dạng sẵn theo giờ VN giống tin tải lúc mở trang. (Flask định dạng
// giờ ở trình duyệt theo múi giờ máy người xem nên 1 tin có thể hiện 2 giờ
// khác nhau giữa lúc tải trang và lúc polling về — ở đây thì không.)

import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getMessagesSince } from "@/lib/api/messages";
import { getTokens } from "@/lib/session";
import { isUuid, toChatMessageView } from "@/lib/messages";

// Không bao giờ cache — tin mới đến từng giây.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** after_id hợp lệ = số nguyên không âm, an toàn trong JS. Thiếu/sai dạng -> 0
 *  (khớp Flask: int() lỗi thì coi là 0), để trả lại toàn bộ lịch sử thay vì lỗi. */
function parseAfterId(raw: string | null): number {
  if (!raw || !/^\d+$/.test(raw)) return 0;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : 0;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> },
) {
  // Khách hoàn toàn (không có cả 2 cookie) -> 401 luôn, khỏi gọi backend vô ích.
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  // partnerId đi thẳng vào câu SQL uuid ở backend -> chặn id rác trước khi
  // chạm backend (cùng lý do với trang /messages/[partnerId]).
  const { partnerId } = await ctx.params;
  if (!isUuid(partnerId)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: NO_STORE });
  }

  const afterId = parseAfterId(req.nextUrl.searchParams.get("after_id"));

  try {
    const rows = await getMessagesSince(partnerId, afterId);
    return NextResponse.json(rows.map(toChatMessageView), { headers: NO_STORE });
  } catch (err) {
    // 401 giữ nguyên (client dừng polling). Lỗi khác (429 rate limit, 404, 5xx,
    // mạng) giữ mã nếu là mã lỗi thật, còn lại quy về 502 — client coi mọi mã
    // != 401 là "lỗi tạm thời" và giãn dần khoảng poll.
    const status =
      err instanceof ApiError && err.status && err.status >= 400 ? err.status : 502;
    // Kèm errorCode (nếu có) để client phân biệt "bị đăng nhập nơi khác" /
    // "phiên bị thu hồi" với 401 hết hạn thường (Phụ lục C).
    const errorCode = err instanceof ApiError ? err.errorCode : undefined;
    return NextResponse.json({ ok: false, errorCode }, { status, headers: NO_STORE });
  }
}
