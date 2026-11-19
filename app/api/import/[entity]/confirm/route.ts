// app/api/import/[entity]/confirm/route.ts
// POST { preview_id, note, resolutions }: GHI THẬT vào DB. Trả created / updated / skipped / reactivated.
//
// `note` bắt buộc và tự trim ở confirmImport() (rỗng sau trim -> 400, không gọi mạng). `resolutions` là
// object khoá theo row_index dạng STRING; sanitizeResolutions() ở confirmImport() bỏ field undefined
// (backend extra="forbid"). Route này KHÔNG tự lọc/đoán dòng nào cần resolution: việc đó thuộc về
// buildConfirmResolutions() phía client (đã có test), route chỉ kiểm hình dạng.

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { confirmImport } from "@/lib/api/import-export";
import type { ImportResolutions } from "@/lib/data-ops/import";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const guard = await guardImportRequest(req, (await params).entity, { mutation: true });
  if (!("entity" in guard)) return guard;

  const body = (await req.json().catch(() => null)) as {
    preview_id?: unknown;
    note?: unknown;
    resolutions?: unknown;
  } | null;
  const previewId = typeof body?.preview_id === "string" ? parsePreviewId(body.preview_id) : null;
  if (!body || !previewId) return importFail(400, "Mã bản xem trước không hợp lệ.");
  if (typeof body.note !== "string" || body.note.trim() === "") {
    return importFail(400, "Cần nhập ghi chú trước khi xác nhận nhập dữ liệu.");
  }
  const res = body.resolutions;
  if (res === null || typeof res !== "object" || Array.isArray(res)) {
    return importFail(400, "Dữ liệu xử lý từng dòng không hợp lệ.");
  }

  try {
    const result = await confirmImport(guard.entity, {
      previewId,
      note: body.note,
      resolutions: res as ImportResolutions,
    });
    // Dữ liệu job/công ty/contact vừa đổi: các trang danh sách phải tải lại.
    revalidatePath("/jobs");
    revalidatePath("/companies");
    revalidatePath("/contacts");
    return importOk({ result });
  } catch (err) {
    return importErrorResponse(err);
  }
}
