// app/api/messages/unread-count/route.ts
// Route Handler cho <UnreadBadge> (polling qua SWR) — plan Phần 3 Nhóm 4
// + Phần 5 mục 15. Khác các route auth (POST), đây là GET chỉ ĐỌC nên
// KHÔNG gọi verifyOrigin() (plan Phần 2 mục 6 chỉ bắt buộc cho route
// mutation dựa vào cookie).
//
// 3 yêu cầu riêng của route polling (plan Nhóm 4):
//   1. Hết phiên phải trả 401 JSON THẬT — không redirect. middleware.ts
//      đã loại /api/* khỏi matcher nên không có redirect nào chen vào;
//      ở đây chỉ cần tự trả đúng mã 401 để fetch phía client tự dừng
//      polling hẳn.
//   2. Tự set Cache-Control: no-store trên response CỦA CHÍNH route này
//      (không dựa vào header backend — đó là header của lời gọi
//      server-to-server, không phải của response trả về trình duyệt).
//   3. Không rơi vào lỗi "Cookies can only be modified in a Server
//      Component": Route Handler ĐƯỢC phép set cookie, nên nhánh refresh
//      phản ứng của callAuthed() (forceRefreshAccessToken) chạy được ở
//      đây — khác khi gọi từ layout (Server Component).

import { NextResponse } from "next/server";
import { ApiError, callAuthed } from "@/lib/api/client";
import { getTokens } from "@/lib/session";
import type { components } from "@/lib/api/types";

type UnreadCountOut = components["schemas"]["UnreadCountOut"];

// Không bao giờ cache — số tin chưa đọc đổi liên tục.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  // Khách hoàn toàn (không có cả 2 cookie) -> trả 401 luôn, khỏi gọi
  // backend vô ích chỉ để nhận lại đúng 401.
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  try {
    const data = await callAuthed<UnreadCountOut>("/messages/unread-count");
    return NextResponse.json({ count: data.count }, { headers: NO_STORE });
  } catch (err) {
    // 401 giữ nguyên 401 (client dừng polling). Các lỗi khác (429 do rate
    // limit 6/phút của backend, 5xx, lỗi mạng) giữ nguyên mã nếu là mã
    // lỗi thật, còn lại quy về 502 — client coi mọi mã != 401 là "lỗi
    // tạm thời" và giãn dần khoảng poll.
    const status =
      err instanceof ApiError && err.status && err.status >= 400 ? err.status : 502;
    return NextResponse.json({ ok: false }, { status, headers: NO_STORE });
  }
}
