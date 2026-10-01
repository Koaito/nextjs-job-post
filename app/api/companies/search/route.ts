// app/api/companies/search/route.ts
// Route Handler cho ô "tìm công ty" gõ-để-lọc ở bộ lọc /activity-logs
// (Nhóm 3, Đợt 3.4, Phần 2/5). Hệ thống đã có hơn 1.200 công ty, plan dự
// kiến 5.000-7.000 -> KHÔNG tải hết về client để lọc tại chỗ như
// <CompanyCombobox> (dành cho form, danh sách vừa phải): mỗi lần gõ gọi
// server lọc theo tên (`keyword`) và chỉ trả tối đa SEARCH_LIMIT dòng.
//
// Client Component không gọi thẳng Scrap_JD được (token nằm trong cookie
// httpOnly) nên phải qua Route Handler này. Cùng khuôn với
// /api/email-templates: GET chỉ ĐỌC nên không verifyOrigin(); hết phiên ->
// 401 JSON thật (không redirect); role "user" -> 403; tự set
// Cache-Control: no-store.
//
// GET /companies là route PUBLIC của backend, nhưng route này vẫn chỉ cho
// staff gọi: nó chỉ phục vụ trang Quản trị, không có lý do mở cho học viên.
// Kết quả GỒM CẢ công ty đã xoá mềm (include_inactive=true): trang này là
// nhật ký lịch sử, log DELETE_COMPANY và mọi log cũ của công ty đã xoá phải
// lọc được. Mỗi dòng trả thêm `active` để ô chọn gắn nhãn "(đã xoá)".

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/session";
import { listCompanies } from "@/lib/api/companies";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Số kết quả tối đa mỗi lần gõ (đã chốt 50; backend cho limit tới 200). */
const SEARCH_LIMIT = 50;
const MAX_QUERY_LENGTH = 100;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }
  if (!user.is_staff) {
    return NextResponse.json({ ok: false }, { status: 403, headers: NO_STORE });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  try {
    const res = await listCompanies(
      { q: q || undefined },
      { limit: SEARCH_LIMIT, offset: 0 },
      { includeInactive: true },
    );
    return NextResponse.json(
      {
        items: res.items.map((c) => ({ id: c.company_id, name: c.company_name, active: c.is_active })),
        total: res.total,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    const status = err instanceof ApiError && err.status && err.status >= 400 ? err.status : 502;
    return NextResponse.json({ ok: false }, { status, headers: NO_STORE });
  }
}
