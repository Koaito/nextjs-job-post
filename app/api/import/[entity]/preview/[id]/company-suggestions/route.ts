// app/api/import/[entity]/preview/[id]/company-suggestions/route.ts
// GET ?row_index=N: lấy lại gợi ý công ty cho đúng MỘT dòng (khi staff mở lại hộp chọn công ty), không
// cần tải lại cả preview. Chỉ job/contact; company không có bước này (backend trả 400).

import type { NextRequest } from "next/server";
import { getImportCompanySuggestions } from "@/lib/api/import-export";
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const p = await params;
  const guard = await guardImportRequest(req, p.entity, { mutation: false });
  if (!("entity" in guard)) return guard;
  const previewId = parsePreviewId(p.id);
  if (!previewId) return importFail(400, "Mã bản xem trước không hợp lệ.");
  const rowIndex = parseRowParam(new URL(req.url).searchParams.get("row_index"));
  if (rowIndex === null) return importFail(400, "Số dòng không hợp lệ.");

  try {
    return importOk({
      suggestions: await getImportCompanySuggestions(guard.entity, previewId, rowIndex),
    });
  } catch (err) {
    return importErrorResponse(err);
  }
}
