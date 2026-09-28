// app/(app)/saved-jobs/route.ts
// URL CŨ /saved-jobs (trước khi dời vào sub-nav Trang cá nhân) — giữ lại thuần
// để không vỡ bookmark/link cũ, chỉ redirect 302 sang route chính thức
// /profile/saved-jobs (plan Nhóm 5; Flask: saved_jobs_legacy()). Không render
// gì, không check quyền ở đây: trang đích tự requireStudent()/đưa khách qua
// /login nên không lặp guard.

import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/profile/saved-jobs";
  url.search = "";
  return NextResponse.redirect(url, 302);
}
