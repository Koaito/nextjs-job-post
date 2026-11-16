// app/api/export/[entity]/preview/route.ts
// Route Handler cho nút "Xem trước" ở /data-management (Nhóm 6, phần 1/3).
// Client Component không gọi thẳng Scrap_JD được (token nằm trong cookie httpOnly).
//
// GET chỉ ĐỌC nên không verifyOrigin(), cùng khuôn /api/companies/search: hết phiên -> 401 JSON
// thật (không redirect); không phải staff -> 403; luôn Cache-Control: no-store.
// Quyền: ss_team là đủ (backend: toàn bộ route import/export chỉ cần staff, KHÔNG có admin-only).
//
// Bộ lọc đi qua parseExportFilters() + validateExportFilters(): sai kiểu/sai entity -> 400 với
// message tiếng Việt, không âm thầm bỏ lọc rồi cho staff tải nhầm. Query gửi backend sinh bằng
// buildExportQuery() — CHÍNH hàm mà route tải file dùng ("xem gì tải đó").

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getExportPreview } from "@/lib/api/import-export";
import { getCurrentUser } from "@/lib/session";
import {
  isDataEntityType,
  parseExportFilters,
  validateExportFilters,
} from "@/lib/data-ops/export-filters";
import { exportHttpErrorMessage } from "@/lib/data-ops/export-ui";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(status: number, message: string) {
  return NextResponse.json({ ok: false, message }, { status, headers: NO_STORE });
}

export async function GET(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail(401, exportHttpErrorMessage(401));
  if (!user.is_staff) return fail(403, exportHttpErrorMessage(403));

  const { entity } = await params;
  if (!isDataEntityType(entity)) return fail(404, "Loại dữ liệu không tồn tại.");

  let filters;
  try {
    filters = parseExportFilters(new URL(req.url).searchParams);
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : "Bộ lọc không hợp lệ.");
  }
  const invalid = validateExportFilters(entity, filters);
  if (invalid) return fail(400, invalid);

  try {
    const preview = await getExportPreview(entity, filters);
    return NextResponse.json({ ok: true, preview }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.status ?? 502, exportHttpErrorMessage(err.status, err.message));
    }
    return fail(502, "Không kết nối được máy chủ dữ liệu.");
  }
}
