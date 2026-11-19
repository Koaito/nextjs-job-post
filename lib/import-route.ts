// lib/import-route.ts
// Phần DÙNG CHUNG của các Route Handler Nhập dữ liệu (app/api/import/**, Nhóm 6, phần 2/3):
// kiểm quyền + nguồn gốc request, tham số URL, và đổi ApiError thành JSON cho Client Component.
//
// Vì sao Route Handler chứ không phải Server Action: upload file lớn phải forward theo STREAM
// (Server Action mặc định chỉ nhận body 1 MB); các lời gọi JSON còn lại đi cùng khuôn cho đồng nhất
// và để test e2e gọi được như người dùng thật.
//
// Quyền: toàn bộ route import/export chỉ cần staff (ss_team) — backend không có nhánh admin-only.
// POST dựa cookie -> BẮT BUỘC verifyOrigin(). GET chỉ đọc nên không cần. Hết phiên -> 401 JSON thật
// (proxy.ts loại /api/*), không redirect.

import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { readImportRowErrors } from "@/lib/api/import-export";
import { isDataEntityType, type DataEntityType } from "@/lib/data-ops/export-filters";
import { importHttpErrorMessage, isPreviewGone } from "@/lib/data-ops/import-ui";
import { getCurrentUser } from "@/lib/session";
import { verifyOrigin } from "@/lib/verify-origin";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body lỗi chuẩn của mọi route import: `ok:false` + message tiếng Việt (+ mã/mảng lỗi nếu có). */
export interface ImportErrorBody {
  ok: false;
  message: string;
  code?: string;
  /** Mảng lỗi cấp dòng của 422 import_row_validation_failed. */
  errors?: unknown[];
}

export function importFail(
  status: number,
  message: string,
  extra: { code?: string; errors?: unknown[] } = {},
): NextResponse {
  const body: ImportErrorBody = { ok: false, message, ...extra };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function importOk(payload: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...payload }, { headers: NO_STORE });
}

/**
 * Kiểm theo thứ tự: nguồn gốc (chỉ POST) -> đăng nhập -> staff -> entity hợp lệ.
 * Trả `{ entity }` nếu qua, hoặc Response lỗi để route trả thẳng.
 */
export async function guardImportRequest(
  req: NextRequest | Request,
  entityParam: string,
  opts: { mutation: boolean },
): Promise<{ entity: DataEntityType } | NextResponse> {
  if (opts.mutation && !verifyOrigin(req as NextRequest).ok) {
    return importFail(403, "Yêu cầu không hợp lệ.");
  }
  const user = await getCurrentUser();
  if (!user) return importFail(401, importHttpErrorMessage(401));
  if (!user.is_staff) return importFail(403, importHttpErrorMessage(403));
  if (!isDataEntityType(entityParam)) return importFail(404, "Loại dữ liệu không tồn tại.");
  return { entity: entityParam };
}

/** preview_id phải là UUID (backend cũng kiểm, nhưng chặn sớm để khỏi tốn một vòng mạng). */
export function parsePreviewId(raw: string): string | null {
  return UUID_RE.test(raw) ? raw : null;
}

/** row_index: số nguyên không âm, tối đa 6 chữ số (file tối đa 5000 dòng). */
export function parseRowParam(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^\d{1,6}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * ApiError -> JSON. Lỗi 4xx giữ nguyên status. Hết hạn/không còn preview có `code` để client bỏ cả
 * preview. 422 file bị từ chối kèm mảng lỗi cấp dòng. Lỗi không phải ApiError (mạng) -> 502.
 */
export function importErrorResponse(err: unknown): NextResponse {
  if (!(err instanceof ApiError)) {
    return importFail(502, "Không kết nối được máy chủ dữ liệu.");
  }
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
  const message = importHttpErrorMessage(err.status, err.errorCode, err.message);
  const rowErrors = readImportRowErrors(err);
  if (rowErrors) {
    return importFail(status, err.message || message, { code: err.errorCode, errors: rowErrors });
  }
  return importFail(status, message, {
    code: err.errorCode && (isPreviewGone(err.status, err.errorCode) || err.errorCode.startsWith("import_"))
      ? err.errorCode
      : undefined,
  });
}
