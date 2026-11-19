// app/api/import/[entity]/preview/[id]/rows/[row]/verify-field/route.ts
// POST { field_name, value }: backend re-validate MỘT ô vừa sửa. Chỉ khi field_error === null thì ô mới
// được coi là đã sửa xong (và đã lưu vào preview). `value` luôn là chuỗi thô như trong file gốc.

import type { NextRequest } from "next/server";
import { verifyImportField } from "@/lib/api/import-export";
import {
  guardImportRequest,
  importErrorResponse,
  importFail,
  importOk,
  parsePreviewId,
  parseRowParam,
} from "@/lib/import-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string; row: string }> },
) {
  const p = await params;
  const guard = await guardImportRequest(req, p.entity, { mutation: true });
  if (!("entity" in guard)) return guard;
  const previewId = parsePreviewId(p.id);
  if (!previewId) return importFail(400, "Mã bản xem trước không hợp lệ.");
  const rowIndex = parseRowParam(p.row);
  if (rowIndex === null) return importFail(400, "Số dòng không hợp lệ.");

  const body = (await req.json().catch(() => null)) as { field_name?: unknown; value?: unknown } | null;
  if (!body || typeof body.field_name !== "string" || body.field_name === "" || typeof body.value !== "string") {
    return importFail(400, "Dữ liệu gửi lên không hợp lệ.");
  }

  try {
    const result = await verifyImportField(guard.entity, previewId, rowIndex, body.field_name, body.value);
    return importOk({ row: result.row, field_error: result.field_error });
  } catch (err) {
    return importErrorResponse(err);
  }
}
