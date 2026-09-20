// app/api/auth/refresh/route.ts
// Route nội bộ để client-side code (SWR, polling...) có thể chủ động
// yêu cầu refresh khi cần — hầu hết trường hợp KHÔNG cần gọi route này
// trực tiếp, vì lib/session.ts (getValidAccessToken/forceRefreshAccessToken)
// đã tự lo refresh cho mọi lời gọi phía Server Component/Server Action.
// Route này chỉ cần khi có logic client-side thuần cần biết "phiên còn
// sống không" mà không tiện đi qua Server Action.

import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

export async function POST(req: NextRequest) {
  const originCheck = verifyOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
