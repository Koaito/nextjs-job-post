// lib/data-ops/import-ui.ts
// Phần THUẦN của giao diện Nhập dữ liệu (Nhóm 6, phần 2/3): nhãn trạng thái, lựa chọn hành động
// theo dòng, kiểm tra file phía client, thông báo lỗi tiếng Việt, câu kết quả. Không import
// server-only/next -> dùng được ở Client Component, Route Handler và test.
//
// Quy tắc lỗi: rẽ nhánh theo error_code/HTTP status, KHÔNG BAO GIỜ theo nội dung message
// (docs/Plan_NextJS.md Phụ lục D). Message backend chỉ để hiển thị, và chỉ khi nó đã là tiếng Việt.

import type { DataEntityType } from "./export-filters";
import {
  IMPORT_MAX_ROWS,
  IMPORT_NOT_FOUND_CODE,
  IMPORT_NOT_FOUND_MESSAGE,
  IMPORT_PREVIEW_EXPIRED_CODE,
  IMPORT_PREVIEW_EXPIRED_MESSAGE,
  type ImportConfirmResult,
  type ImportConflictStatus,
  type ImportPreviewRow,
  type ImportResolutionAction,
} from "./import";

// ---------------------------------------------------------------------------
// Nhãn
// ---------------------------------------------------------------------------

export const IMPORT_STATUS_LABELS: Record<ImportConflictStatus, string> = {
  no_conflict: "Mới",
  conflict: "Trùng bản ghi đã có",
  conflict_inactive: "Trùng bản ghi đã ngừng hoạt động",
  pending_company_resolution: "Chưa chọn công ty",
  conflict_in_batch: "Trùng dòng khác trong file",
};

/** Nhãn cột "Việc cần làm" của các blocker, dùng cho thông báo và tooltip. */
export const IMPORT_BLOCKER_LABELS = {
  action: "Chưa chọn cách xử lý",
  level: "Chưa chọn lại level",
  fix: "Còn ô lỗi chưa xác nhận",
  reactivate: "Chưa xác nhận kích hoạt lại",
} as const;

export interface ActionOption {
  value: ImportResolutionAction;
  label: string;
}

/**
 * Hành động staff được chọn cho 1 dòng. [] = không có lựa chọn (dòng no_conflict luôn được tạo mới;
 * cặp conflict_in_batch hai chiều có UI riêng cho cả cặp).
 */
export function actionOptionsFor(row: Pick<ImportPreviewRow, "conflict_status">): ActionOption[] {
  switch (row.conflict_status) {
    case "conflict":
      return [
        { value: "skip", label: "Bỏ qua" },
        { value: "update", label: "Cập nhật bản ghi đã có" },
        { value: "create", label: "Vẫn tạo mới" },
      ];
    case "conflict_inactive":
      return [
        { value: "skip", label: "Bỏ qua" },
        { value: "update", label: "Cập nhật và kích hoạt lại" },
        { value: "create", label: "Vẫn tạo mới" },
      ];
    case "pending_company_resolution":
      return [{ value: "skip", label: "Bỏ qua dòng này" }];
    case "conflict_in_batch":
      // Chỉ dùng khi liên kết cặp không hai chiều: skip/create riêng từng dòng.
      return [
        { value: "skip", label: "Bỏ qua" },
        { value: "create", label: "Giữ dòng này" },
      ];
    default:
      return [];
  }
}

/** 3 nút của cặp conflict_in_batch. `value` là action lan truyền gửi cho backend. */
export function pairChoiceLabels(
  loRowNumber: number,
  hiRowNumber: number,
): { value: "keep_this" | "keep_other" | "import_both"; label: string }[] {
  return [
    { value: "keep_this", label: `Giữ dòng ${loRowNumber}, bỏ dòng ${hiRowNumber}` },
    { value: "keep_other", label: `Giữ dòng ${hiRowNumber}, bỏ dòng ${loRowNumber}` },
    { value: "import_both", label: "Cả hai đều đúng, giữ cả hai" },
  ];
}

/** Cột chính hiện ngay trên mỗi dòng preview; các cột còn lại xem trong phần mở rộng của dòng. */
export const IMPORT_PREVIEW_COLUMNS: Record<DataEntityType, string[]> = {
  job: ["job_title", "company_name", "deadline", "level_code"],
  company: ["company_name", "tax_id", "website", "industry"],
  contact: ["contact_name", "work_email", "company_name", "job_title"],
};

/**
 * Cột bắt buộc của file, chỉ để NHẮC staff trước khi tải lên. Nguồn thật là required_fields trong
 * scrapjd/api/services/entity_specs.py (backend vẫn kiểm và từ chối file thiếu cột); sao tay nên có
 * test ghim giá trị, đổi bên backend thì sửa cả hai.
 */
export const IMPORT_REQUIRED_COLUMNS: Record<DataEntityType, string[]> = {
  job: ["job_title", "company_name", "deadline"],
  company: ["company_name"],
  contact: ["contact_name", "work_email", "company_name"],
};

// ---------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------

/** Trần body backend (MAX_REQUEST_BODY_MB mặc định 15). Vercel có thể chặn sớm hơn (~4,5 MB): xem 413. */
export const IMPORT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const IMPORT_ACCEPT = ".csv,.xlsx";

/** Lỗi tiếng Việt nếu file không nên gửi lên, hoặc null. Backend vẫn kiểm lại định dạng thật của nội dung. */
export function validateImportFile(file: { name: string; size: number } | null | undefined): string | null {
  if (!file) return "Vui lòng chọn file CSV hoặc XLSX.";
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
    return "Chỉ nhận file .csv hoặc .xlsx.";
  }
  if (file.size === 0) return "File rỗng, không có dữ liệu để nhập.";
  if (file.size > IMPORT_MAX_FILE_BYTES) return "File quá lớn (tối đa 15 MB). Hãy chia nhỏ file rồi tải lại.";
  return null;
}

// ---------------------------------------------------------------------------
// Lỗi
// ---------------------------------------------------------------------------

/**
 * Thông báo cho staff từ (status, error_code). `fallback` (message backend) chỉ được dùng khi status
 * thuộc nhóm 4xx nghiệp vụ mà ta không có câu riêng — và khi backend đã viết tiếng Việt.
 */
export function importHttpErrorMessage(
  status: number | undefined,
  errorCode?: string,
  fallback?: string,
): string {
  if (status === 410 || errorCode === IMPORT_PREVIEW_EXPIRED_CODE) return IMPORT_PREVIEW_EXPIRED_MESSAGE;
  if (errorCode === IMPORT_NOT_FOUND_CODE) return IMPORT_NOT_FOUND_MESSAGE;
  if (errorCode === "import_file_format_unsupported") return "Chỉ nhận file .csv hoặc .xlsx.";
  if (errorCode === "import_file_row_limit_exceeded") {
    return `File vượt quá ${IMPORT_MAX_ROWS} dòng. Hãy chia nhỏ file rồi tải lại.`;
  }
  if (status === 401) return "Phiên đăng nhập đã hết. Vui lòng tải lại trang và đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền dùng chức năng này.";
  if (status === 413) return "File quá lớn để máy chủ nhận. Hãy chia nhỏ file rồi tải lại.";
  if (status === 429) {
    return "Bạn thao tác quá nhanh (tối đa 20 lượt tải file mỗi giờ). Vui lòng thử lại sau ít phút.";
  }
  if (status !== undefined && status >= 500) return "Máy chủ đang bận hoặc gặp lỗi, vui lòng thử lại sau.";
  return fallback || "Không thực hiện được yêu cầu.";
}

/** Có nên bỏ cả preview và quay về khung upload không (hết hạn / không còn / không thuộc user). */
export function isPreviewGone(status: number | undefined, errorCode?: string): boolean {
  return status === 410 || errorCode === IMPORT_PREVIEW_EXPIRED_CODE || errorCode === IMPORT_NOT_FOUND_CODE;
}

// ---------------------------------------------------------------------------
// Hiển thị
// ---------------------------------------------------------------------------

/** Câu kết quả sau confirm: 3 số chính; "kích hoạt lại" là tập con của "cập nhật", không cộng thêm. */
export function formatImportResult(result: ImportConfirmResult): string {
  const updated =
    result.reactivated > 0
      ? `${result.updated} (trong đó ${result.reactivated} kích hoạt lại)`
      : String(result.updated);
  return `Tạo mới ${result.created}, cập nhật ${updated}, bỏ qua ${result.skipped}.`;
}

/**
 * Giá trị ban đầu đưa vào ô sửa lỗi. Ô ngày (<input type="date">) chỉ nhận yyyy-mm-dd: giá trị thô trong
 * file như "31/31/2030" sẽ bị trình duyệt coi là sai định dạng (hiện trống, và không điền được) nên bỏ trống
 * để staff chọn lại; các loại ô khác giữ nguyên chuỗi thô.
 */
export function initialFixInputValue(widget: string, rawValue: string): string {
  if (widget !== "date") return rawValue;
  return /^\d{4}-\d{2}-\d{2}$/.test(rawValue) ? rawValue : "";
}

/** Ô dữ liệu của dòng preview -> chuỗi thuần để hiển thị (không HTML). */
export function formatImportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Độ khớp 0–1 của gợi ý công ty -> "87%". */
export function formatSimilarity(similarity: number): string {
  if (!Number.isFinite(similarity)) return "";
  return `${Math.round(Math.min(1, Math.max(0, similarity)) * 100)}%`;
}

/** Số trang cho danh sách dòng (client phân trang để không dựng hàng nghìn <tr>). */
export const IMPORT_ROWS_PER_PAGE = 50;

export function pageCount(total: number, perPage: number = IMPORT_ROWS_PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage));
}
