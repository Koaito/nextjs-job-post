// lib/api/jobs.ts
// Tương đương crawler_client/jobs.py bên Flask (phần list/normalize —
// create/update/status thuộc phần sau của Nhóm 1, chưa làm ở đây).
//
// GET /jobs là route PUBLIC (chỉ cần X-API-Key, không cần đăng nhập) —
// dùng callPublic(), KHÔNG dùng callAuthed() (xem lib/api/client.ts).

import { callPublic } from "./client";
import type { components } from "./types";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_LABELS_REV,
  WORK_TYPE_LABELS,
  SALARY_TYPE_LABELS,
} from "@/lib/constants";

export type JobOut = components["schemas"]["JobOut"];
export type PaginatedJobs = components["schemas"]["PaginatedJobs"];

export interface JobFilters {
  q?: string;
  industry?: string;
  level?: string;
  location?: string;
  /** Nhãn VN ("Đang tuyển"/"Đã đóng") hoặc "" (mặc định = Đang tuyển,
   *  khớp _index_filters() bên Flask) hoặc "ALL" (tắt hẳn filter). */
  status?: string;
}

/** Chuẩn hoá filter -> query param backend thật, gán mặc định
 *  status="OPEN" khi không truyền gì — ĐÚNG _index_filters() bên
 *  Flask: trang chủ mặc định chỉ hiện job "Đang tuyển", không phải
 *  hiện tất cả trạng thái. */
function buildJobQuery(filters: JobFilters, extra: Record<string, string | number>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("keyword", filters.q);
  if (filters.industry) params.set("industry", filters.industry);
  if (filters.level) params.set("level", filters.level);
  if (filters.location) params.set("province", filters.location);

  const statusLabel = filters.status ?? "";
  if (statusLabel === "ALL") {
    // Không set "status" -> backend trả mọi trạng thái.
  } else if (statusLabel) {
    params.set("status", JOB_STATUS_LABELS_REV[statusLabel] ?? statusLabel);
  } else {
    params.set("status", "OPEN");
  }

  for (const [k, v] of Object.entries(extra)) params.set(k, String(v));
  return params.toString();
}

export async function listJobs(
  filters: JobFilters,
  { limit, offset }: { limit: number; offset: number },
): Promise<PaginatedJobs> {
  const qs = buildJobQuery(filters, { limit, offset });
  return callPublic<PaginatedJobs>(`/jobs?${qs}`);
}

/** Chế độ cuộn liên tục (view=infinite) — CHƯA dùng ở round này (chỉ
 *  làm "Phân trang" trước theo đúng phạm vi đã chốt), giữ lại chữ ký
 *  hàm sẵn để không phải sửa lib/api/jobs.ts lần nữa khi làm tiếp. */
export async function listJobsCursor(
  filters: JobFilters,
  { limit, cursor }: { limit: number; cursor?: string | null },
): Promise<PaginatedJobs> {
  const qs = buildJobQuery(filters, cursor ? { limit, cursor } : { limit });
  return callPublic<PaginatedJobs>(`/jobs?${qs}`);
}

export interface JobCardData {
  id: string;
  position: string;
  company: string;
  companyId: string;
  industry: string;
  level: string;
  location: string;
  workType: string;
  statusLabel: string;
  statusRaw: string;
  salaryDisplay: string;
  deadline: string | null;
  source: string;
  jdLink: string;
}

/** Khớp ĐÚNG _fmt_salary() bên crawler_client/jobs.py — bản trước chỉ
 *  copy 1 nửa hàm gốc (thiếu hẳn phần salary_type), gây mất thông tin
 *  so với Flask dù SALARY_TYPE_LABELS đã có sẵn ở constants.ts:
 *   - period_suffix CHỈ gắn "/ Năm" khi period=YEAR, không gắn
 *     "/ Tháng" cho case mặc định (xem README bug "lương '/năm' bị
 *     hiểu nhầm thành lương/tháng").
 *   - LUÔN có "(salary_type)" ở cuối khi có min/max (vd "(Khoảng lương)").
 *   - Khi KHÔNG có cả min lẫn max, trả về salary_type (vd "Không lương")
 *     thay vì luôn luôn "Thỏa thuận" — Flask fallback "Thỏa thuận" CHỈ
 *     khi salary_type cũng rỗng.
 *   - Dùng dấu phẩy ngăn cách hàng nghìn giống Python `{:,.0f}` (không
 *     phải dấu chấm kiểu `toLocaleString("vi-VN")`) để không đổi cách
 *     hiển thị con số so với bản Flask hiện tại — thay đổi cách hiển
 *     thị không nằm trong phạm vi round này. */
function formatSalary(job: JobOut): string {
  const { salary_min, salary_max } = job;
  const currency = job.currency || "VNĐ";
  const salaryTypeLabel = SALARY_TYPE_LABELS[job.salary_type || ""] || job.salary_type || "";
  const periodSuffix = (job.salary_period || "MONTH") === "YEAR" ? " / Năm" : "";

  if (!salary_min && !salary_max) return salaryTypeLabel || "Thỏa thuận";

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const amount =
    salary_min && salary_max
      ? `${fmt(salary_min)} - ${fmt(salary_max)}`
      : fmt((salary_min || salary_max)!);

  return `${amount} ${currency}${periodSuffix} (${salaryTypeLabel})`.trim();
}

export function toJobCardData(job: JobOut): JobCardData {
  return {
    id: job.job_id,
    position: job.job_title,
    company: job.company_name,
    companyId: job.company_id,
    industry: job.matching_industry || "",
    level: job.level_code || "",
    location: job.province_name || "",
    workType: WORK_TYPE_LABELS[job.work_type || ""] || job.work_type || "",
    statusLabel: JOB_STATUS_LABELS[job.job_status || ""] || job.job_status || "",
    statusRaw: job.job_status || "OPEN",
    salaryDisplay: formatSalary(job),
    deadline: job.deadline ?? null,
    source: job.source_name || "",
    jdLink: job.source_url || "",
  };
}
