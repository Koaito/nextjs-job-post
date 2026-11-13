// lib/api/import-export.ts
// Nhóm 6, trang /data-management: Xuất + Nhập dữ liệu (job / company / contact).
// Tương đương crawler_client/import_export.py bên Flask.
//
// QUYỀN: toàn bộ 8 route chỉ cần ss_team (requireStaff) — KHÔNG có route
// admin-only ở nhóm này. Đừng áp nhầm mẫu "xem = staff, chạy = admin" của
// Crawl/Bảo trì sang đây. File này không tự check quyền (cùng quy ước các
// module lib/api/ khác): nơi gọi tự requireStaff().
//
// Hàm thuần (build query export, type dòng preview, hằng số lỗi...) nằm ở
// lib/data-ops/export-filters.ts + import.ts để Client Component import được;
// file này CHỈ chứa lời gọi mạng (server-only, qua callAuthed/callAuthedStream).

import { ApiError, callAuthed, callAuthedStream } from "./client";
import type { components } from "./types";
import {
  buildExportDownloadQuery,
  buildExportQuery,
  type DataEntityType,
  type ExportFilters,
  type ExportFormat,
} from "@/lib/data-ops/export-filters";
import {
  IMPORT_NEW_COMPANY_ID,
  IMPORT_NOT_FOUND_CODE,
  IMPORT_PREVIEW_EXPIRED_CODE,
  IMPORT_ROW_VALIDATION_FAILED_CODE,
  normalizeImportRow,
  resolutionKey,
  type ExportPreview,
  type ImportCompanySuggestion,
  type ImportConfirmResult,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportPreviewSummary,
  type ImportResolutions,
  type ImportRowError,
  type ImportRowResolution,
} from "@/lib/data-ops/import";

// ---------------------------------------------------------------------------
// Xuất dữ liệu
// ---------------------------------------------------------------------------

/**
 * GET /export/{entity}/preview — tối đa 20 dòng mẫu + tổng số dòng khớp.
 * Dùng CHUNG buildExportQuery() với downloadExport() để "xem gì tải đó".
 * Backend trả 400 (error_code riêng) nếu filter không hợp lệ với entity.
 */
export async function getExportPreview(
  entity: DataEntityType,
  filters: ExportFilters,
): Promise<ExportPreview> {
  const qs = buildExportQuery(filters);
  return callAuthed<ExportPreview>(
    `/export/${encodeURIComponent(entity)}/preview${qs ? `?${qs}` : ""}`,
  );
}

/**
 * GET /export/{entity}?format=... — trả NGUYÊN `Response` (chưa đọc body) để
 * Route Handler forward theo stream cùng header Content-Disposition mà backend
 * đã đặt sẵn, trình duyệt tự xử lý việc tải. KHÔNG dựng luồng blob thủ công.
 */
export async function downloadExport(
  entity: DataEntityType,
  filters: ExportFilters,
  format: ExportFormat,
): Promise<Response> {
  const qs = buildExportDownloadQuery(filters, format);
  return callAuthedStream(`/export/${encodeURIComponent(entity)}?${qs}`);
}

// ---------------------------------------------------------------------------
// Nhập dữ liệu
// ---------------------------------------------------------------------------

type RawUpload = components["schemas"]["ImportUploadResponse"];

/**
 * Chuẩn hoá response thô (rows/summary là dict tự do trong OpenAPI) thành
 * ImportPreview có kiểu. Chỉ ép kiểu + điền mặc định, không đổi dữ liệu.
 */
export function parseImportPreview(raw: RawUpload): ImportPreview {
  return {
    preview_id: raw.preview_id,
    entity_type: raw.entity_type as DataEntityType,
    summary: raw.summary as unknown as ImportPreviewSummary,
    rows: raw.rows.map((r) => normalizeImportRow(r as Record<string, unknown>)),
  };
}

export interface UploadImportOptions {
  /** Header Content-Type NGUYÊN BẢN của request multipart (có `boundary=...`) —
   *  bắt buộc khi `body` là stream, vì boundary nằm trong header chứ không
   *  trong body. Với FormData thì BỎ QUA (fetch tự sinh). */
  contentType?: string;
  /** Content-Length nguyên bản nếu biết. Chưa kiểm chứng trên Vercel — mặc
   *  định không gửi (chunked); chỉ bật nếu test preview thật cho thấy cần. */
  contentLength?: string;
}

/**
 * POST /import/{entity}/preview — upload file (multipart/form-data, field
 * `file`) -> preview. Rate limit 20 lượt/giờ theo user -> 429 (không có
 * error_code).
 *
 * `body` THƯỜNG là `request.body` của Route Handler, forward theo STREAM
 * (KHÔNG `await request.formData()` rồi dựng lại — tốn bộ nhớ và dễ chạm
 * giới hạn body của Vercel). Với body stream:
 *   - bắt buộc `duplex: "half"` (đã đặt sẵn ở đây);
 *   - KHÔNG retry sau 401 (stream chỉ đọc được 1 lần, xem callAuthedStream) —
 *     token đã được refresh chủ động trước lời gọi nên 401 rất hiếm; nếu có,
 *     lỗi lan lên và UI báo người dùng thử lại.
 *
 * Lỗi cần chú ý (đều là ApiError):
 *   - 400 import_file_format_unsupported / import_file_row_limit_exceeded (5000 dòng);
 *   - 422 import_row_validation_failed kèm mảng `errors` -> readImportRowErrors().
 */
export async function uploadImportPreview(
  entity: DataEntityType,
  body: ReadableStream<Uint8Array> | FormData,
  opts: UploadImportOptions = {},
): Promise<ImportPreview> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isForm) {
    if (opts.contentType) headers["Content-Type"] = opts.contentType;
    if (opts.contentLength) headers["Content-Length"] = opts.contentLength;
  }
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    body: body as BodyInit,
    headers,
    ...(isForm ? {} : { duplex: "half" as const }),
  };
  const res = await callAuthedStream(`/import/${encodeURIComponent(entity)}/preview`, init);
  return parseImportPreview((await res.json()) as RawUpload);
}

/**
 * GET /import/{entity}/preview/{id} — lấy lại TOÀN BỘ preview. Bắt buộc gọi
 * lại sau verify-field / resolve-company của entity CONTACT: sửa 1 ô có thể
 * làm đổi ngầm dòng KHÁC (duplicate_in_batch ảnh hưởng 2 chiều) mà response
 * của verify chỉ trả đúng dòng vừa sửa -> chỉ patch 1 dòng là lệch.
 * 404 import_not_found (không tồn tại / không thuộc user, cố ý giống hệt nhau),
 * 410 import_preview_expired.
 */
export async function getImportPreview(
  entity: DataEntityType,
  previewId: string,
): Promise<ImportPreview> {
  return parseImportPreview(
    await callAuthed<RawUpload>(
      `/import/${encodeURIComponent(entity)}/preview/${encodeURIComponent(previewId)}`,
    ),
  );
}

/**
 * GET .../company-suggestions?row_index= — lấy lại gợi ý công ty cho ĐÚNG 1
 * dòng (khi staff mở lại modal để đổi ý), không cần tải lại cả preview.
 * Chỉ job/contact. Độ khớp là `similarity` (0–1).
 */
export async function getImportCompanySuggestions(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
): Promise<ImportCompanySuggestion[]> {
  const res = await callAuthed<components["schemas"]["CompanySuggestionsResponse"]>(
    `/import/${encodeURIComponent(entity)}/preview/${encodeURIComponent(previewId)}` +
      `/company-suggestions?row_index=${rowIndex}`,
  );
  return res.suggestions ?? [];
}

export interface VerifyImportFieldResult {
  /** Toàn bộ dòng sau cập nhật (nếu hợp lệ) hoặc dòng hiện tại (nếu vẫn lỗi). */
  row: ImportPreviewRow;
  /** Còn lỗi -> {rule, message} (message KHÔNG có tiền tố "Dòng N"), không lưu gì;
   *  null -> đã hợp lệ và đã lưu vào preview. */
  field_error: { rule: string; message: string } | null;
}

/**
 * POST .../rows/{row_index}/verify-field — gửi lại 1 ô vừa sửa cho backend
 * re-validate. Một ô chỉ được coi là "đã sửa xong" khi field_error === null
 * (KHÔNG coi "có giá trị không rỗng" là hợp lệ). `value` luôn là string thô
 * (như trong file gốc, vd ngày YYYY-MM-DD).
 */
export async function verifyImportField(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
  fieldName: string,
  value: string,
): Promise<VerifyImportFieldResult> {
  const res = await callAuthed<components["schemas"]["FieldVerifyResponse"]>(
    `/import/${encodeURIComponent(entity)}/preview/${encodeURIComponent(previewId)}` +
      `/rows/${rowIndex}/verify-field`,
    { method: "POST", body: JSON.stringify({ field_name: fieldName, value }) },
  );
  const fe = res.field_error as { rule?: string; message?: string } | null | undefined;
  return {
    row: normalizeImportRow(res.row as Record<string, unknown>),
    field_error: fe ? { rule: fe.rule ?? "", message: fe.message ?? "" } : null,
  };
}

/**
 * POST .../rows/{row_index}/resolve-company — staff chọn công ty cho dòng
 * pending_company_resolution (chỉ job/contact).
 *   - `companyId = null` hoặc IMPORT_NEW_COMPANY_ID: "tạo công ty mới" —
 *     backend coi chắc chắn chưa tồn tại, chuyển thẳng no_conflict;
 *   - `companyId` = UUID thật: backend chạy lại detect trùng với tên + id
 *     công ty THẬT (không dùng lại company_name trong file).
 * Với entity contact: sau lời gọi này nên getImportPreview() lại (xem ghi chú).
 */
export async function resolveImportCompany(
  entity: DataEntityType,
  previewId: string,
  rowIndex: number,
  companyId: string | null,
): Promise<ImportPreviewRow> {
  const res = await callAuthed<components["schemas"]["ResolveCompanyResponse"]>(
    `/import/${encodeURIComponent(entity)}/preview/${encodeURIComponent(previewId)}` +
      `/rows/${rowIndex}/resolve-company`,
    {
      method: "POST",
      body: JSON.stringify({ company_id: companyId === IMPORT_NEW_COMPANY_ID ? null : companyId }),
    },
  );
  return normalizeImportRow(res.row as Record<string, unknown>);
}

/**
 * Loại field `undefined` khỏi từng resolution (JSON.stringify đã bỏ, nhưng
 * làm tường minh để test được) và chốt khoá là string. Backend là
 * extra="forbid" nên TUYỆT ĐỐI không thêm field lạ. KHÔNG tự lược dòng nào —
 * quyết định "dòng nào đưa vào" thuộc về nơi dựng payload (reducer), vì nó
 * phụ thuộc cả conflict_status lẫn needs_level_resolve.
 */
export function sanitizeResolutions(resolutions: ImportResolutions): ImportResolutions {
  const out: ImportResolutions = {};
  for (const [key, res] of Object.entries(resolutions)) {
    const clean: ImportRowResolution = { action: res.action };
    if (res.company_id !== undefined) clean.company_id = res.company_id;
    if (res.confirm_reactivate !== undefined) clean.confirm_reactivate = res.confirm_reactivate;
    if (res.level_code !== undefined) clean.level_code = res.level_code;
    if (res.field_fixes !== undefined) clean.field_fixes = res.field_fixes;
    out[resolutionKey(Number(key))] = clean;
  }
  return out;
}

export interface ConfirmImportInput {
  previewId: string;
  /** Ghi chú bắt buộc — tự .trim(); rỗng sau trim -> ném Error, không gọi mạng. */
  note: string;
  resolutions: ImportResolutions;
}

/**
 * POST /import/{entity}/confirm — ghi thật vào DB. Trả created / updated /
 * skipped (+ `reactivated`: tập con của `updated`, số bản ghi ngừng hoạt động
 * được import này kích hoạt lại, KHÔNG cộng thêm vào tổng).
 *
 * Lỗi cần chú ý: 410 import_preview_expired; 404 import_not_found; 422
 * import_row_resolution_failed (thiếu resolution cho dòng conflict_in_batch,
 * liên kết cặp không còn khớp hai chiều, action update không hợp lệ...) — hiện
 * message rõ ràng, staff tự xử lý được.
 */
export async function confirmImport(
  entity: DataEntityType,
  input: ConfirmImportInput,
): Promise<ImportConfirmResult> {
  const note = input.note.trim();
  if (!note) throw new Error("Cần nhập ghi chú trước khi xác nhận nhập dữ liệu.");
  return callAuthed<ImportConfirmResult>(`/import/${encodeURIComponent(entity)}/confirm`, {
    method: "POST",
    body: JSON.stringify({
      preview_id: input.previewId,
      note,
      resolutions: sanitizeResolutions(input.resolutions),
    }),
  });
}

// ---------------------------------------------------------------------------
// Đọc lỗi
// ---------------------------------------------------------------------------

/** 410 (hoặc error_code) preview quá hạn -> hiện IMPORT_PREVIEW_EXPIRED_MESSAGE. */
export function isImportPreviewExpired(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 410 || err.errorCode === IMPORT_PREVIEW_EXPIRED_CODE)
  );
}

/** Preview không tồn tại / không thuộc user (cùng 404, cùng error_code) -> 1 câu chung. */
export function isImportPreviewNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.errorCode === IMPORT_NOT_FOUND_CODE;
}

/**
 * Mảng lỗi cấp dòng của 422 import_row_validation_failed (file bị từ chối
 * hoàn toàn). Trả null nếu lỗi này không phải loại đó. Mảng có thể rất dài
 * (file tới 5000 dòng) — hiển thị qua summarizeImportRowErrors().
 */
export function readImportRowErrors(err: unknown): ImportRowError[] | null {
  if (!(err instanceof ApiError) || err.errorCode !== IMPORT_ROW_VALIDATION_FAILED_CODE) return null;
  const errors = err.detail?.errors;
  return Array.isArray(errors) ? (errors as ImportRowError[]) : null;
}
