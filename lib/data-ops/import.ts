// lib/data-ops/import.ts
// Phần THUẦN của luồng Nhập dữ liệu (Nhóm 6): type dòng preview, type payload
// confirm, hằng số, hàm đọc lỗi. Không gọi mạng, không import server-only ->
// reducer/component phía client import trực tiếp được. Lời gọi API ở
// lib/api/import-export.ts.
//
// OpenAPI khai `rows` / `summary` / `row` là dict tự do (dict[Any, Any]) nên các
// type dưới viết tay, bám cấu trúc ghi ở đầu scrapjd/api/services/preview_manager.py.

import type { components } from "@/lib/api/types";
import type { DataEntityType } from "./export-filters";

export type { DataEntityType } from "./export-filters";

export type ExportPreview = components["schemas"]["ExportPreviewResponse"];
export type ImportConfirmResult = components["schemas"]["ImportConfirmResult"];
/** 1 công ty gợi ý. Độ khớp là `similarity` (0–1) — KHÔNG phải `score`. */
export type ImportCompanySuggestion = components["schemas"]["CompanySuggestionOut"];

// ---------------------------------------------------------------------------
// Dòng preview
// ---------------------------------------------------------------------------

/**
 * Một dòng mang NHIỀU trục trạng thái ĐỘC LẬP — không gộp thành một union:
 * conflict_status, needs_level_resolve và needs_field_fix có thể cùng bật.
 */
export type ImportConflictStatus =
  | "no_conflict"
  | "conflict"
  | "conflict_inactive"
  | "pending_company_resolution"
  | "conflict_in_batch";

export type ImportFieldWidgetType = "enum" | "date" | "number" | "email" | "text";

/** Lỗi của 1 ô cần sửa tại chỗ. Dùng ĐÚNG `widget_type`/`options` backend trả, không đoán theo tên field. */
export interface ImportFieldError {
  rule: string;
  /** Hiển thị NGUYÊN VĂN. Lúc build preview có sẵn tiền tố "Dòng N, cột 'x':",
   *  lúc verify-field thì không — đừng tự ghép hay bóc tách tiền tố. */
  message: string;
  raw_value: string | null;
  widget_type: ImportFieldWidgetType;
  /** Chỉ khi widget_type === "enum". */
  options: string[] | null;
}

/** Trùng mờ với bản ghi ĐÃ CÓ trong DB (chỉ Contact). */
export interface ImportDuplicateMatch {
  match_score: number;
  matched_fields: string[];
}

/** Trùng mờ với 1 DÒNG KHÁC trong chính file (chỉ Contact, conflict_in_batch). */
export interface ImportBatchDuplicateMatch extends ImportDuplicateMatch {
  other_row_index: number;
}

export interface ImportCompanyResolution {
  status: "resolved" | "needs_resolution";
  company_id: string | null;
  company_is_active: boolean | null;
  suggestions: ImportCompanySuggestion[];
}

export interface ImportPreviewRow {
  row_index: number;
  /** Dữ liệu đã làm sạch của dòng — khoá phụ thuộc entity. */
  data: Record<string, unknown>;
  conflict_status: ImportConflictStatus;
  /** Bản ghi đã có trong DB khi conflict / conflict_inactive. */
  existing_record: Record<string, unknown> | null;
  duplicate_match?: ImportDuplicateMatch | null;
  duplicate_in_batch?: ImportBatchDuplicateMatch | null;
  /** Chỉ job/contact. */
  company_resolution?: ImportCompanyResolution;
  /** Chỉ Job: level_code trong file không thuộc 7 giá trị hợp lệ. */
  needs_level_resolve?: boolean;
  needs_field_fix: boolean;
  /** {} khi needs_field_fix = false. Khoá = tên field. */
  field_errors: Record<string, ImportFieldError>;
  /**
   * Cờ tổng hợp do BACKEND tính: conflict_status !== "no_conflict" ||
   * needs_level_resolve || needs_field_fix. Dùng cờ này (đừng tự OR lại ở nhiều
   * nơi). Riêng dòng no_conflict + needs_level_resolve vẫn phải gửi resolution
   * kèm level_code — cờ này đã bật cho ca đó.
   */
  needs_resolution: boolean;
}

export interface ImportPreviewSummary {
  total_rows: number;
  new_records: number;
  conflicts: number;
  conflicts_inactive: number;
  pending_company_resolution: number;
  conflicts_in_batch: number;
  pending_level_resolution: number;
  pending_field_fix: number;
  id_field: "job_id" | "company_id" | "contact_id";
}

export interface ImportPreview {
  preview_id: string;
  entity_type: DataEntityType;
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
}

/**
 * Chuẩn hoá 1 dòng thô của backend: điền mặc định cho field có thể vắng
 * (needs_field_fix/field_errors/needs_resolution) để reducer khỏi xử lý `undefined`.
 * Không "sửa" dữ liệu — chỉ ép kiểu + mặc định.
 */
export function normalizeImportRow(raw: Record<string, unknown>): ImportPreviewRow {
  const row = raw as unknown as Partial<ImportPreviewRow> & Pick<ImportPreviewRow, "row_index" | "conflict_status">;
  return {
    ...(row as ImportPreviewRow),
    data: row.data ?? {},
    existing_record: row.existing_record ?? null,
    needs_field_fix: Boolean(row.needs_field_fix),
    field_errors: row.field_errors ?? {},
    needs_resolution: Boolean(row.needs_resolution),
  };
}

// ---------------------------------------------------------------------------
// Payload confirm
// ---------------------------------------------------------------------------

/**
 * Action gửi lên confirm. KHÔNG có "reactivate": muốn kích hoạt lại bản ghi
 * ngừng hoạt động thì gửi action "update" kèm confirm_reactivate: true.
 *
 * keep_this / keep_other / import_both CHỈ cho dòng conflict_in_batch, áp dụng
 * cho CẢ CẶP chỉ từ 1 resolution (backend tự điền dòng còn lại theo
 * duplicate_in_batch.other_row_index). "update" không hợp lệ cho dòng đó.
 */
export type ImportResolutionAction =
  | "skip"
  | "create"
  | "update"
  | "keep_this"
  | "keep_other"
  | "import_both";

/** Action lan truyền theo cặp (conflict_in_batch). */
export const IMPORT_BATCH_PROPAGATING_ACTIONS = ["keep_this", "keep_other", "import_both"] as const;

export function isBatchPropagatingAction(action: ImportResolutionAction): boolean {
  return (IMPORT_BATCH_PROPAGATING_ACTIONS as readonly string[]).includes(action);
}

/**
 * Resolution của 1 dòng. Schema backend là extra="forbid": field lạ làm hỏng
 * CẢ request. Chỉ đặt field thật sự áp dụng cho action đang gửi; field nào
 * `undefined` sẽ bị bỏ khi build payload (xem sanitizeResolutions ở
 * lib/api/import-export.ts).
 */
export interface ImportRowResolution {
  action: ImportResolutionAction;
  /** Dòng pending_company_resolution + create/update: UUID công ty đã chọn. */
  company_id?: string | null;
  /** BẮT BUỘC true khi action = "update" cho dòng conflict_inactive. */
  confirm_reactivate?: boolean;
  /** BẮT BUỘC (1 trong 7 level hợp lệ) khi dòng needs_level_resolve. */
  level_code?: string | null;
  /** field_name -> giá trị staff đã sửa (luôn string thô). BẮT BUỘC đủ mọi field còn lỗi nếu action != skip. */
  field_fixes?: Record<string, string>;
}

/** Khoá = row_index DẠNG STRING ({"0": {...}, "3": {...}}), KHÔNG phải mảng. */
export type ImportResolutions = Record<string, ImportRowResolution>;

/** Khoá resolutions cho 1 dòng — luôn qua hàm này để không lẫn số/chuỗi. */
export function resolutionKey(rowIndex: number): string {
  return String(rowIndex);
}

/** Giá trị `company_id` báo "tạo công ty mới" (backend cũng nhận null). */
export const IMPORT_NEW_COMPANY_ID = "__new__";

// ---------------------------------------------------------------------------
// Lỗi
// ---------------------------------------------------------------------------

/** error_code backend khi preview quá hạn (1 giờ), kèm HTTP 410. */
export const IMPORT_PREVIEW_EXPIRED_CODE = "import_preview_expired";
/** Preview không tồn tại HOẶC không thuộc user — backend cố ý trả GIỐNG HỆT nhau (404). */
export const IMPORT_NOT_FOUND_CODE = "import_not_found";
/** 422 khi file có dòng không hợp lệ -> không import gì, kèm mảng `errors`. */
export const IMPORT_ROW_VALIDATION_FAILED_CODE = "import_row_validation_failed";

/** Backend trả message tiếng Anh cho 410 -> luôn hiện câu tiếng Việt cố định này. */
export const IMPORT_PREVIEW_EXPIRED_MESSAGE =
  "Bản xem trước đã hết hạn (quá 1 giờ). Vui lòng tải file lên lại.";
/** UI không tách "không tồn tại" và "không thuộc user" — dùng chung 1 câu. */
export const IMPORT_NOT_FOUND_MESSAGE = "Không tìm thấy bản xem trước. Vui lòng tải file lên lại.";

/** Giới hạn file của backend: 5000 dòng/lần, CSV hoặc XLSX. */
export const IMPORT_MAX_ROWS = 5000;

/** 1 lỗi cấp dòng của file bị từ chối hoàn toàn (422). Có thể tới hàng nghìn phần tử. */
export interface ImportRowError {
  row_number: number;
  field_name: string;
  rule: string;
  message: string;
}

/** Bản Flask chỉ hiện tối đa 20 dòng lỗi đầu + "... và N dòng lỗi khác". */
export const IMPORT_ROW_ERRORS_DISPLAY_LIMIT = 20;

/** Cắt mảng lỗi để hiển thị: 20 dòng đầu + số dòng bị ẩn. */
export function summarizeImportRowErrors(
  errors: ImportRowError[],
  limit: number = IMPORT_ROW_ERRORS_DISPLAY_LIMIT,
): { shown: ImportRowError[]; hiddenCount: number } {
  return { shown: errors.slice(0, limit), hiddenCount: Math.max(0, errors.length - limit) };
}
