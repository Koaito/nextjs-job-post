// lib/data-ops/export-filters.ts
// Phần THUẦN của luồng Xuất dữ liệu (Nhóm 6): type filter, build query string,
// validate theo entity. Không gọi mạng, không import server-only -> dùng được
// ở Client Component (form lọc) lẫn Route Handler. Lời gọi API ở
// lib/api/import-export.ts.
//
// NGUYÊN TẮC "xem gì tải đó": preview (GET /export/{entity}/preview) và tải
// file (GET /export/{entity}) dùng chung MỘT hàm build query — buildExportQuery()
// — không viết hai lần riêng rẽ. Nút tải chỉ được bật khi
// exportFiltersKey(bộ lọc hiện tại) === key của lần preview gần nhất.

export const DATA_ENTITY_TYPES = ["job", "company", "contact"] as const;
export type DataEntityType = (typeof DATA_ENTITY_TYPES)[number];

export function isDataEntityType(value: string): value is DataEntityType {
  return (DATA_ENTITY_TYPES as readonly string[]).includes(value);
}

export const EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(value);
}

export type ExportDateField = "created_at" | "updated_at";

/** Bộ lọc export. Chuỗi rỗng / undefined = "không lọc" (không gửi lên). */
export interface ExportFilters {
  /** job_status (job) hoặc contact_status (contact) — KEY backend, không phải nhãn. */
  status?: string;
  /** Chỉ company/contact. true/false; undefined = cả hai. */
  is_active?: boolean;
  /** Chỉ job/contact. UUID công ty. */
  company_id?: string;
  date_field?: ExportDateField;
  /** YYYY-MM-DD, theo NGÀY VIỆT NAM (UTC+7). */
  from_date?: string;
  to_date?: string;
  /** N dòng MỚI NHẤT (áp sau các filter khác). > 0. */
  limit?: number;
}

/**
 * Filter nào có nghĩa với entity nào — khớp _build_export_filters() ở backend
 * (Job không có is_active; Company không có status/company_id). Dùng để ẩn
 * ô lọc không áp dụng, thay vì để backend trả 400.
 */
export const EXPORT_FILTER_SUPPORT: Record<
  DataEntityType,
  { status: boolean; is_active: boolean; company_id: boolean }
> = {
  job: { status: true, is_active: false, company_id: true },
  company: { status: false, is_active: true, company_id: false },
  contact: { status: true, is_active: true, company_id: true },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Query string CHUẨN HOÁ của bộ lọc (không gồm `format`): thứ tự khoá cố định,
 * bỏ giá trị rỗng/undefined, chỉ gửi date_field khi có from/to (không có ngày
 * thì date_field vô nghĩa). Hai bộ lọc tương đương -> cùng một chuỗi, nên chuỗi
 * này vừa là query gửi backend vừa là "khoá" để so sánh preview với tải file.
 */
export function buildExportQuery(filters: ExportFilters): string {
  const params = new URLSearchParams();
  const status = filters.status?.trim();
  if (status) params.set("status", status);
  if (filters.is_active !== undefined) params.set("is_active", filters.is_active ? "true" : "false");
  const companyId = filters.company_id?.trim();
  if (companyId) params.set("company_id", companyId);
  const hasDate = Boolean(filters.from_date || filters.to_date);
  if (hasDate) params.set("date_field", filters.date_field ?? "created_at");
  if (filters.from_date) params.set("from_date", filters.from_date);
  if (filters.to_date) params.set("to_date", filters.to_date);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  return params.toString();
}

/** Khoá so sánh "bộ lọc hiện tại có khớp lần xem trước không" — chính là query chuẩn hoá. */
export function exportFiltersKey(filters: ExportFilters): string {
  return buildExportQuery(filters);
}

/** Query + `format` cho request tải file (format luôn đứng SAU bộ lọc). */
export function buildExportDownloadQuery(filters: ExportFilters, format: ExportFormat): string {
  const base = buildExportQuery(filters);
  return base ? `${base}&format=${format}` : `format=${format}`;
}

/**
 * Parse querystring (vd searchParams của Route Handler) thành ExportFilters,
 * theo đúng whitelist — khoá lạ bị bỏ. Giá trị sai kiểu (is_active="abc",
 * limit="x") ném Error để Route Handler trả 400 thay vì âm thầm bỏ lọc (backend
 * cũng nguyên tắc này: không âm thầm bỏ qua filter staff tưởng đã áp dụng).
 */
export function parseExportFilters(source: URLSearchParams): ExportFilters {
  const out: ExportFilters = {};
  const status = source.get("status");
  if (status) out.status = status;

  const isActive = source.get("is_active");
  if (isActive) {
    if (isActive !== "true" && isActive !== "false") throw new Error("is_active chỉ nhận true/false.");
    out.is_active = isActive === "true";
  }

  const companyId = source.get("company_id");
  if (companyId) out.company_id = companyId;

  const dateField = source.get("date_field");
  if (dateField) {
    if (dateField !== "created_at" && dateField !== "updated_at") {
      throw new Error("date_field chỉ nhận created_at hoặc updated_at.");
    }
    out.date_field = dateField;
  }

  const from = source.get("from_date");
  if (from) out.from_date = from;
  const to = source.get("to_date");
  if (to) out.to_date = to;

  const limit = source.get("limit");
  if (limit) {
    const n = Number(limit);
    if (!Number.isInteger(n)) throw new Error("limit phải là số nguyên.");
    out.limit = n;
  }
  return out;
}

/**
 * Kiểm tra bộ lọc theo entity ở phía client, báo lỗi tiếng Việt sớm. Backend
 * vẫn là nơi quyết định (trả 400) — đây chỉ để khỏi gọi mạng vô ích. Trả
 * `null` nếu hợp lệ, ngược lại là thông báo đầu tiên.
 */
export function validateExportFilters(entity: DataEntityType, filters: ExportFilters): string | null {
  const support = EXPORT_FILTER_SUPPORT[entity];
  if (filters.status && !support.status) return "Loại dữ liệu này không có bộ lọc trạng thái.";
  if (filters.is_active !== undefined && !support.is_active) {
    return "Loại dữ liệu này không có bộ lọc còn hoạt động / đã ngừng.";
  }
  if (filters.company_id && !support.company_id) return "Loại dữ liệu này không lọc theo công ty.";

  if (filters.from_date && !DATE_RE.test(filters.from_date)) return "Ngày bắt đầu không đúng định dạng.";
  if (filters.to_date && !DATE_RE.test(filters.to_date)) return "Ngày kết thúc không đúng định dạng.";
  // YYYY-MM-DD so sánh theo chữ cái đúng thứ tự thời gian.
  if (filters.from_date && filters.to_date && filters.from_date > filters.to_date) {
    return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
  }
  if (filters.limit !== undefined && (!Number.isInteger(filters.limit) || filters.limit <= 0)) {
    return "Số dòng tối đa phải là số nguyên lớn hơn 0.";
  }
  return null;
}
