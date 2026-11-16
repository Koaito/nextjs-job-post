// lib/data-ops/export-ui.ts
// Phần THUẦN của giao diện Xuất dữ liệu (Nhóm 6, phần 1/3): nhãn, lựa chọn trạng thái,
// đổi giá trị form -> ExportFilters, định dạng ô xem trước, thông báo lỗi theo HTTP status.
// Không import server-only/next -> dùng được ở Client Component, Route Handler và test.
//
// Bộ lọc thật (query chuẩn hoá, validate, "xem gì tải đó") nằm ở export-filters.ts; file này
// chỉ nối form với các hàm đó.

import { CONTACT_STATUS_CODES, CONTACT_STATUS_LABELS, JOB_STATUS_LABELS } from "@/lib/constants";
import {
  EXPORT_FILTER_SUPPORT,
  isDataEntityType,
  type DataEntityType,
  type ExportDateField,
  type ExportFilters,
} from "./export-filters";

export const DATA_ENTITY_LABELS: Record<DataEntityType, string> = {
  job: "Job",
  company: "Công ty",
  contact: "Contact",
};

/** Entity mặc định khi ?entity= thiếu hoặc lạ (khớp Flask: mở trang là tab Job). */
export const DEFAULT_DATA_ENTITY: DataEntityType = "job";

/** Đọc ?entity= từ searchParams. Giá trị lạ/thiếu -> mặc định, không ném lỗi. */
export function parseEntityParam(raw: string | string[] | undefined): DataEntityType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && isDataEntityType(value) ? value : DEFAULT_DATA_ENTITY;
}

export interface StatusOption {
  value: string;
  label: string;
}

/** Lựa chọn trạng thái theo entity. Company không có bộ lọc trạng thái -> mảng rỗng. VALUE là KEY backend. */
export function exportStatusOptions(entity: DataEntityType): StatusOption[] {
  if (entity === "job") {
    return Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  }
  if (entity === "contact") {
    return CONTACT_STATUS_CODES.map((value) => ({ value, label: CONTACT_STATUS_LABELS[value] ?? value }));
  }
  return [];
}

/** Giá trị thô của form lọc (toàn chuỗi, như <select>/<input> trả về). */
export interface ExportFormValues {
  status: string;
  isActive: "" | "true" | "false";
  companyId: string;
  dateField: ExportDateField;
  fromDate: string;
  toDate: string;
  limit: string;
}

export const EMPTY_EXPORT_FORM: ExportFormValues = {
  status: "",
  isActive: "",
  companyId: "",
  dateField: "created_at",
  fromDate: "",
  toDate: "",
  limit: "",
};

/**
 * Form -> ExportFilters, CHỈ giữ field entity có hỗ trợ (đổi entity rồi form còn giá trị cũ
 * cũng không lọt sang backend để bị 400). Số dòng tối đa không phải số nguyên -> trả lỗi tiếng Việt.
 */
export function formToExportFilters(
  entity: DataEntityType,
  form: ExportFormValues,
): { filters: ExportFilters; error: string | null } {
  const support = EXPORT_FILTER_SUPPORT[entity];
  const filters: ExportFilters = {};

  if (support.status && form.status) filters.status = form.status;
  if (support.is_active && form.isActive) filters.is_active = form.isActive === "true";
  if (support.company_id && form.companyId) filters.company_id = form.companyId;
  if (form.fromDate) filters.from_date = form.fromDate;
  if (form.toDate) filters.to_date = form.toDate;
  if (form.fromDate || form.toDate) filters.date_field = form.dateField;

  const limitText = form.limit.trim();
  if (limitText) {
    // Number("1e3") = 1000 và Number("0x10") = 16: chỉ nhận chuỗi toàn chữ số.
    if (!/^\d+$/.test(limitText)) {
      return { filters, error: "Số dòng tối đa phải là số nguyên lớn hơn 0." };
    }
    filters.limit = Number(limitText);
  }
  return { filters, error: null };
}

const MAX_CELL_CHARS = 120;

/** Ô xem trước -> chuỗi thuần để render (React tự escape; không dùng dangerouslySetInnerHTML). */
export function formatPreviewCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else {
    try {
      text = JSON.stringify(value) ?? "";
    } catch {
      text = "";
    }
  }
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text;
}

/** Thông báo tiếng Việt cho lỗi HTTP của route xem trước/tải file. `fallback` = message backend (nếu có). */
export function exportHttpErrorMessage(status: number | undefined, fallback?: string): string {
  if (status === 401) return "Phiên đăng nhập đã hết. Vui lòng tải lại trang và đăng nhập lại.";
  if (status === 403 || status === 404) return "Bạn không có quyền dùng chức năng này.";
  if (status === 429) return "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.";
  if (status !== undefined && status >= 500) return "Máy chủ đang bận hoặc gặp lỗi, vui lòng thử lại sau.";
  return fallback || "Không thực hiện được yêu cầu.";
}
