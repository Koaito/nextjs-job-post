// app/api/email-templates/route.ts
// Route Handler cho <EmailTemplatePickerModal> (popup "✉ Mẫu email") — plan
// Phần 2 mục 5, dòng `inject_email_templates`: fetch khi staff THẬT SỰ bấm
// nút (không nhúng sẵn vào mọi trang như Flask), và chỉ staff mới gọi được
// — học viên/khách không bị tốn round-trip thừa.
//
// Client Component không gọi thẳng Scrap_JD được (token nằm trong cookie
// httpOnly, chỉ phía server đọc được) nên phải qua Route Handler này.
//
// GET chỉ ĐỌC -> không gọi verifyOrigin() (plan Phần 2 mục 6 chỉ bắt buộc
// cho route mutation). Cùng khuôn với /api/messages/unread-count:
//   - hết phiên -> 401 JSON thật, không redirect (proxy.ts đã loại
//     /api/* khỏi matcher);
//   - tự set Cache-Control: no-store trên response của CHÍNH route này;
//   - route chỉ dành cho staff: role "user" nhận 403 (backend cũng chặn
//     bằng require_role("ss_team"), chặn sớm ở đây để khỏi gọi vô ích).

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/session";
import { listEmailTemplates } from "@/lib/api/email-templates";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }
  if (!user.is_staff) {
    return NextResponse.json({ ok: false }, { status: 403, headers: NO_STORE });
  }

  try {
    const templates = await listEmailTemplates();
    // full_name đi kèm để popup thay {{TEN_STAFF}} (Flask đọc từ
    // data-staff-name trên <body>; ở đây không có body dùng chung nên trả
    // cùng response, khỏi thêm 1 round-trip riêng).
    return NextResponse.json({ templates, staffName: user.full_name }, { headers: NO_STORE });
  } catch (err) {
    const status = err instanceof ApiError && err.status && err.status >= 400 ? err.status : 502;
    return NextResponse.json({ ok: false }, { status, headers: NO_STORE });
  }
}
