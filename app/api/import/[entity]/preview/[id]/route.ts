// app/api/import/[entity]/preview/[id]/route.ts
// GET: tải lại TOÀN BỘ preview. Client gọi sau verify-field / resolve-company của CONTACT, vì sửa một
// ô có thể làm đổi ngầm dòng KHÁC (duplicate_in_batch ảnh hưởng hai chiều) mà response của verify chỉ
// trả đúng dòng vừa sửa.

import type { NextRequest } from "next/server";
import { getImportPreview } from "@/lib/api/import-export";
import {
  guardImportRequest,
  importErrorResponse,
  importFail,
  importOk,
  parsePreviewId,
} from "@/lib/import-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const p = await params;
  const guard = await guardImportRequest(req, p.entity, { mutation: false });
  if (!("entity" in guard)) return guard;
  const previewId = parsePreviewId(p.id);
  if (!previewId) return importFail(400, "Mã bản xem trước không hợp lệ.");

  try {
    return importOk({ preview: await getImportPreview(guard.entity, previewId) });
  } catch (err) {
    return importErrorResponse(err);
  }
}
