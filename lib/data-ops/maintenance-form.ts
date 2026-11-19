// lib/data-ops/maintenance-form.ts
// Form kích hoạt job bảo trì (tab Bảo trì của /crawl, Nhóm 6 phần 3d): kiểm tra đầu vào + thông báo lỗi tiếng Việt.
// Thuần (không gọi mạng, không server-only): Client Component dùng để báo lỗi ngay trên form, Route Handler dùng
// lại ĐÚNG quy tắc kiểm body (không tin client), nên hai nơi không thể lệch nhau.
//
// Quy tắc theo job (đọc qua lib/data-ops/maintenance.ts, KHÔNG hard-code theo tên job ở đây):
//   - job tốn phí (maintenanceRequiresLimit) bắt buộc `limit`, các job khác để trống = chạy hết;
//   - `dry_run` / `check_deadline_only` chỉ tồn tại với job maintenanceSupportsDryRun(); gửi cho job khác là 400,
//     kể cả khi giá trị là `false` (backend kiểm `is not None`), nên không bao giờ gửi false "cho đủ field".

import { parseOptionalInt } from "@/lib/data-ops/crawl-form";
import {
  MAINTENANCE_LIMIT_MAX,
  MAINTENANCE_LIMIT_MIN,
  MAINTENANCE_DRY_RUN_JOB_TYPE,
  isMaintenanceJobType,
  maintenanceRequiresLimit,
  maintenanceSupportsDryRun,
  type MaintenanceJobType,
  type MaintenanceRunRequest,
} from "@/lib/data-ops/maintenance";
import { UPSTREAM_TIMEOUT_MESSAGE, isUpstreamTimeout } from "@/lib/upstream-timeout";

export interface MaintenanceFormErrors {
  limit?: string;
}

export type MaintenanceFormResult =
  | { ok: true; request: MaintenanceRunRequest }
  | { ok: false; errors: MaintenanceFormErrors };

export interface MaintenanceFormInput {
  jobType: MaintenanceJobType;
  /** Nội dung ô giới hạn (chuỗi, có thể rỗng). */
  limitText: string;
  dryRun: boolean;
  checkDeadlineOnly: boolean;
}

const LIMIT_RANGE_MESSAGE = `Giới hạn phải là số nguyên từ ${MAINTENANCE_LIMIT_MIN} đến ${MAINTENANCE_LIMIT_MAX}.`;
const LIMIT_REQUIRED_MESSAGE =
  "Job này gọi dịch vụ tốn phí thật (Tavily/Gemini): bắt buộc nhập giới hạn số công ty xử lý.";

/**
 * Kiểm form phía trình duyệt. Chỉ đưa vào request những field THỰC SỰ có giá trị:
 * limit rỗng -> bỏ; dry_run/check_deadline_only chỉ gửi (`true`) cho job hỗ trợ, và chỉ khi được tick.
 */
export function validateMaintenanceForm(input: MaintenanceFormInput): MaintenanceFormResult {
  const errors: MaintenanceFormErrors = {};
  const limit = parseOptionalInt(input.limitText, MAINTENANCE_LIMIT_MIN, MAINTENANCE_LIMIT_MAX);
  if (!limit.ok) errors.limit = LIMIT_RANGE_MESSAGE;
  else if (limit.value === undefined && maintenanceRequiresLimit(input.jobType)) errors.limit = LIMIT_REQUIRED_MESSAGE;
  if (errors.limit || !limit.ok) return { ok: false, errors };

  const request: MaintenanceRunRequest = {};
  if (limit.value !== undefined) request.limit = limit.value;
  if (maintenanceSupportsDryRun(input.jobType)) {
    if (input.dryRun) request.dry_run = true;
    if (input.checkDeadlineOnly) request.check_deadline_only = true;
  }
  return { ok: true, request };
}

const ALLOWED_BODY_KEYS = new Set(["limit", "dry_run", "check_deadline_only"]);

/**
 * Kiểm BODY JSON của POST /api/maintenance/{jobType} phía server (không tin client). Chặt hơn form: chỉ nhận đúng
 * 3 khoá (backend extra="forbid"); `limit` là số nguyên trong biên; boolean đúng kiểu; `null` coi như vắng mặt
 * (backend cũng coi null là None). Trả request đã chuẩn hoá hoặc `{ message }` để route trả 400.
 */
export function validateMaintenanceBody(
  jobType: string,
  body: unknown,
): { jobType: MaintenanceJobType; request: MaintenanceRunRequest } | { message: string } {
  if (!isMaintenanceJobType(jobType)) return { message: "Loại job bảo trì không hợp lệ." };
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "Dữ liệu gửi lên không hợp lệ." };
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_BODY_KEYS.has(key)) return { message: "Dữ liệu gửi lên có trường không hợp lệ." };
  }

  const request: MaintenanceRunRequest = {};

  if (raw.limit !== undefined && raw.limit !== null) {
    const n = raw.limit;
    if (typeof n !== "number" || !Number.isInteger(n) || n < MAINTENANCE_LIMIT_MIN || n > MAINTENANCE_LIMIT_MAX) {
      return { message: LIMIT_RANGE_MESSAGE };
    }
    request.limit = n;
  }
  if (maintenanceRequiresLimit(jobType) && request.limit === undefined) return { message: LIMIT_REQUIRED_MESSAGE };

  for (const key of ["dry_run", "check_deadline_only"] as const) {
    const v = raw[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") return { message: "Dữ liệu gửi lên không hợp lệ." };
    // Kể cả `false` cũng bị backend từ chối ở job khác, nên chặn luôn ở đây (không đụng backend).
    if (!maintenanceSupportsDryRun(jobType)) {
      return { message: `dry_run/check_deadline_only chỉ áp dụng cho job ${MAINTENANCE_DRY_RUN_JOB_TYPE}.` };
    }
    request[key] = v;
  }
  return { jobType, request };
}

/**
 * Thông báo cho lỗi kích hoạt, rẽ nhánh theo status/error_code (không đọc nội dung message backend, trừ ca 400
 * dùng làm fallback). 429 backend KHÔNG có error_code (chỉ có status), nên phải rẽ theo status.
 */
export function maintenanceTriggerErrorMessage(status: number, errorCode?: string, fallback?: string): string {
  if (status === 409 || errorCode === "maintenance_already_active") {
    return "Job này đang có lượt chạy dở. Đợi lượt đó xong rồi chạy lại.";
  }
  if (status === 429) return "Đã chạy quá 10 lượt bảo trì trong 1 giờ. Thử lại sau.";
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Chỉ admin mới được chạy job bảo trì.";
  if (status === 413) return "Dữ liệu gửi lên quá lớn.";
  if (status === 0) return "Không kết nối được máy chủ. Vui lòng thử lại.";
  if (isUpstreamTimeout(status, errorCode)) return UPSTREAM_TIMEOUT_MESSAGE;
  if (status >= 500) return "Máy chủ dữ liệu đang gặp sự cố. Vui lòng thử lại sau.";
  return fallback || "Không chạy được job bảo trì. Vui lòng kiểm tra lại lựa chọn.";
}
