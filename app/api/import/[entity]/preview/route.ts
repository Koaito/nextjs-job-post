// app/api/import/[entity]/preview/route.ts
// POST: upload file CSV/XLSX -> preview (Nhóm 6, phần 2/3, tab Nhập dữ liệu).
//
// Body được forward THEO STREAM (`req.body` + `duplex: "half"` ở uploadImportPreview) cùng header
// Content-Type nguyên bản (có `boundary=...`): KHÔNG `await req.formData()` rồi dựng lại, vì file tới
// 5000 dòng sẽ bị đọc hết vào RAM và dễ chạm giới hạn body của Vercel. Route chỉ là "ống dẫn".
//
// Lỗi hay gặp (đều qua importErrorResponse): 400 sai định dạng / quá 5000 dòng, 422 file bị từ chối kèm
// mảng lỗi cấp dòng, 429 (backend giới hạn 20 lượt/giờ/user).
// LƯU Ý Vercel: body ~4,5 MB trở lên có thể bị nền tảng chặn (413) TRƯỚC khi vào đây — chưa kiểm chứng,
// client đã có thông báo riêng cho 413.

import type { NextRequest } from "next/server";
import { uploadImportPreview } from "@/lib/api/import-export";
import {
  guardImportRequest,
  importErrorResponse,
  importFail,
  importOk,
} from "@/lib/import-route";

export const dynamic = "force-dynamic";
// Trần thời gian chạy (giây): số viết thẳng vì Next đọc tĩnh. Mức và lý do ở tests/lib/route-max-duration.test.ts.
export const maxDuration = 180;

export async function POST(req: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  const guard = await guardImportRequest(req, (await params).entity, { mutation: true });
  if (!("entity" in guard)) return guard;

  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) || !req.body) {
    return importFail(400, "Vui lòng chọn file CSV hoặc XLSX để tải lên.");
  }

  try {
    const preview = await uploadImportPreview(guard.entity, req.body, { contentType });
    return importOk({ preview });
  } catch (err) {
    return importErrorResponse(err);
  }
}
