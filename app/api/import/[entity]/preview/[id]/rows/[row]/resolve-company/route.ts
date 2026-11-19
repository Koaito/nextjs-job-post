// app/api/import/[entity]/preview/[id]/rows/[row]/resolve-company/route.ts
// POST { company_id }: staff chọn công ty cho dòng pending_company_resolution (chỉ job/contact).
//   - company_id = null hoặc "__new__": tạo công ty mới (backend coi chắc chắn chưa tồn tại);
//   - company_id = UUID thật: backend chạy lại dò trùng với tên + id công ty THẬT.
// Client chỉ gửi đúng một trong hai dạng này, không chạy logic gì thêm.

import type { NextRequest } from "next/server";
import { resolveImportCompany } from "@/lib/api/import-export";
import { IMPORT_NEW_COMPANY_ID } from "@/lib/data-ops/import";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const body = (await req.json().catch(() => null)) as { company_id?: unknown } | null;
  const raw = body?.company_id;
  const isNew = raw === null || raw === IMPORT_NEW_COMPANY_ID;
  if (!body || !(isNew || (typeof raw === "string" && UUID_RE.test(raw)))) {
    return importFail(400, "Công ty được chọn không hợp lệ.");
  }

  try {
    const row = await resolveImportCompany(guard.entity, previewId, rowIndex, isNew ? null : (raw as string));
    return importOk({ row });
  } catch (err) {
    return importErrorResponse(err);
  }
}
