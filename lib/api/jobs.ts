// lib/api/jobs.ts
// Tương đương crawler_client/jobs.py bên Flask (phần list/normalize —
// create/update/status thuộc phần sau của Nhóm 1, chưa làm ở đây).
//
// GET /jobs là route PUBLIC (chỉ cần X-API-Key, không cần đăng nhập) —
// dùng callPublic(), KHÔNG dùng callAuthed() (xem lib/api/client.ts).

import { callAuthed, callPublic } from "./client";
import type { components } from "./types";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_LABELS_REV,
  WORK_TYPE_LABELS,
  SALARY_TYPE_LABELS,
} from "@/lib/constants";

export type JobOut = components["schemas"]["JobOut"];
export type JobDetailOut = components["schemas"]["JobDetailOut"];
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
interface SalaryFields {
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type?: string | null;
  salary_period?: string | null;
  currency?: string | null;
}

function formatSalary(job: SalaryFields): string {
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

// ---------------------------------------------------------------------------
// Nhóm 1, phần 2 — job_detail.html -> app/(app)/jobs/[jobId]/page.tsx.
// GET /jobs/{id} trả JobDetailOut (KHÁC JobOut của GET /jobs list) — LUÔN
// kèm parsed_content/ss_team_notes đầy đủ, không có tham số include_content
// nào ở đây (khác list, xem comment ở lib/api/jobs.ts phần trên) vì đây là
// đúng 1 job nên trả full ngay, không cần tiết kiệm payload như list.
// -----------------------------------------------------------------------

export async function getJob(jobId: string): Promise<JobDetailOut | null> {
  try {
    return await callPublic<JobDetailOut>(`/jobs/${jobId}`);
  } catch {
    // Khớp db_data.get_job() bên Flask: job không tồn tại -> None, để
    // page.tsx tự quyết định notFound() thay vì để lỗi mạng chung chung
    // (404 thật) lẫn với "job không tồn tại" (cũng thường là 404 từ
    // backend) — cả 2 đều rơi vào nhánh này, khớp hành vi Flask hiện tại
    // (job_id sai định dạng UUID hay không tồn tại đều render 404).
    return null;
  }
}

export interface JobDetailData {
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
  dateCollected: string | null;
  description: string;
  requirements: string;
  benefits: string;
  skills: string[];
  note: string;
}

/** Khớp _normalize_job() bên Flask phần đọc parsed_content — 4 key con
 *  (job_description/requirements/perks/required_skills), mọi key đều
 *  optional/có thể null, không đọc thẳng job.parsed_content.xxx mà
 *  không qua fallback rỗng (job nhập tay cũ có thể parsed_content = null
 *  hoàn toàn, không chỉ thiếu từng key con). */
export function toJobDetailData(job: JobDetailOut): JobDetailData {
  const parsed = (job.parsed_content ?? {}) as {
    job_description?: string | null;
    requirements?: string | null;
    perks?: string | null;
    required_skills?: string[] | null;
  };
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
    dateCollected: job.created_at ?? null,
    description: parsed.job_description || "",
    requirements: parsed.requirements || "",
    benefits: parsed.perks || "",
    skills: parsed.required_skills ?? [],
    note: job.ss_team_notes || "",
  };
}

/** PATCH /jobs/{id} chỉ với job_status (+ note audit log tuỳ chọn) —
 *  dùng CHUNG cho cả 2 nút "Cập nhật trạng thái" (mọi status) và
 *  "Đóng job" (status=CLOSED cố định) ở job_detail.html, đúng
 *  update_job_status() bên Flask. note KHÔNG bắt buộc (khớp
 *  jobStatusModal/jobDeleteModal — khác hẳn note bắt buộc ở Nhóm 2). */
export async function updateJobStatus(
  jobId: string,
  status: "OPEN" | "CLOSED",
  note?: string,
): Promise<JobDetailOut> {
  return callAuthed<JobDetailOut>(`/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ job_status: status, note: note?.trim() || null }),
  });
}

/** ĐÃ BỎ: is_duplicate_candidate (aside "Trùng lặp?" ở job_detail.html).
 *  Lý do: bản Flask gọi thẳng db_data.is_duplicate_candidate(job) — 1
 *  hàm query trực tiếp DB, không qua REST API. Backend FastAPI mới
 *  KHÔNG có field này trên JobDetailOut (xem lib/api/types.ts) — cơ
 *  chế phát hiện trùng ở backend mới nằm ở `duplicate_job_groups`
 *  (dạng bulk, không phải "true/false cho 1 job", nhiều khả năng
 *  thuộc phần trạng thái dữ liệu ở Nhóm 6). Round trước có viết 1 bản
 *  tự chế gọi listJobs({q: company}) rồi so sánh thủ công để giả lập
 *  — đây là suy đoán không khớp cách backend mới hoạt động, tốn thêm
 *  1 API call mỗi lần load trang mà không nằm trong phạm vi plan chỉ
 *  định cho Nhóm 1, nên bỏ hẳn thay vì giữ lại 1 bản đoán sai. Nếu
 *  Nhóm 6 xác nhận có endpoint tương đương, làm lại đúng chỗ đó. */

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
