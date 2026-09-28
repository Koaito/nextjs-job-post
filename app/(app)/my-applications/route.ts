// app/(app)/my-applications/route.ts
// URL CŨ /my-applications (trước khi dời vào sub-nav Trang cá nhân) — giữ lại
// thuần để không vỡ bookmark/link cũ, chỉ redirect 302 sang route chính thức
// /profile/applications (plan Nhóm 5; Flask: my_applications_legacy()).
// Không render gì, không check quyền ở đây: trang đích tự requireStudent().

import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/profile/applications";
  url.search = "";
  return NextResponse.redirect(url, 302);
}
