// lib/data-ops/maintenance.ts
// Phần THUẦN của nhóm Bảo trì (5 job_type, quy tắc form, type `stats` theo
// từng job) — không gọi mạng, không import server-only, nên Client Component
// import trực tiếp được. Lời gọi API nằm ở lib/api/maintenance.ts.

import type { components } from "@/lib/api/types";

export type MaintenanceRunRequest = components["schemas"]["MaintenanceRunRequest"];
export type MaintenanceAccepted = components["schemas"]["MaintenanceAccepted"];
export type MaintenanceStatus = components["schemas"]["MaintenanceStatusOut"];
export type MaintenanceLogLine = components["schemas"]["MaintenanceLogOut"];
export type MaintenanceLogs = components["schemas"]["MaintenanceLogsOut"];
export type PaginatedMaintenanceRuns = components["schemas"]["PaginatedMaintenanceRuns"];

// ---------------------------------------------------------------------------
// 5 job_type + quy tắc form
// ---------------------------------------------------------------------------

/** Khớp MAINTENANCE_JOB_TYPES (scrapjd/api/schemas/maintenance.py). Thứ tự = thứ tự hiện trên UI. */
export const MAINTENANCE_JOB_TYPES = [
  "backfill_company_profiles",
  "enrich_profile_from_website",
  "enrich_web_info",
  "get_fb_linkedin",
  "check_expired_jobs",
] as const;

export type MaintenanceJobType = (typeof MAINTENANCE_JOB_TYPES)[number];

export function isMaintenanceJobType(value: string): value is MaintenanceJobType {
  return (MAINTENANCE_JOB_TYPES as readonly string[]).includes(value);
}

/**
 * Job BẮT BUỘC `limit` khi kích hoạt từ web (400 nếu thiếu) vì gọi
 * Tavily/Gemini tốn phí thật. Khớp MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT ở
 * backend.
 *
 * CHÚ Ý: plan cũ ghi "2 job tốn phí bắt buộc limit", nhưng backend hiện chỉ
 * còn `enrich_web_info` (get_fb_linkedin đã gỡ khỏi set từ 08/2026 vì chỉ
 * fetch HTML thô, không tốn phí). Bám theo BACKEND. Nếu sau này backend
 * thêm job vào set này, sửa đúng 1 chỗ ở đây — UI đọc qua
 * maintenanceRequiresLimit(), không hard-code theo tên job ở component.
 */
export const MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT: readonly MaintenanceJobType[] = [
  "enrich_web_info",
];

export function maintenanceRequiresLimit(jobType: MaintenanceJobType): boolean {
  return MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT.includes(jobType);
}

/** Chỉ job này nhận `dry_run` / `check_deadline_only` — gửi cho job khác là 400. */
export const MAINTENANCE_DRY_RUN_JOB_TYPE: MaintenanceJobType = "check_expired_jobs";

export function maintenanceSupportsDryRun(jobType: MaintenanceJobType): boolean {
  return jobType === MAINTENANCE_DRY_RUN_JOB_TYPE;
}

/** Biên `limit` theo backend: 1..5000. */
export const MAINTENANCE_LIMIT_MIN = 1;
export const MAINTENANCE_LIMIT_MAX = 5000;

// ---------------------------------------------------------------------------
// `stats` — 5 hình dạng KHÁC HẲN nhau theo job_type (khác crawl chỉ có 1 shape)
// ---------------------------------------------------------------------------
// Định nghĩa riêng từng job + map theo key, KHÔNG gộp thành 1 interface toàn
// field optional (mất type-safety, dễ nhầm field job này sang job khác).
// Nguồn: dict `stats` khởi tạo trong run() của từng script ở
// scrapjd/maintenance/*.py.

/** backfill_company_profiles */
export interface BackfillCompanyProfilesStats {
  checked: number;
  updated: number;
  unchanged: number;
  unknown_domain: number;
  errors: number;
}

/** enrich_profile_from_website (Gemini) */
export interface EnrichProfileFromWebsiteStats {
  checked: number;
  updated: number;
  no_page_content: number;
  low_confidence: number;
  fetch_failed: number;
  errors: number;
  industry_updated: number;
  products_services_updated: number;
}

/** enrich_web_info (Tavily + Gemini — tốn phí) */
export interface EnrichWebInfoStats {
  checked: number;
  updated: number;
  no_result: number;
  errors: number;
  website_name_mismatch: number;
  merged_duplicate_company: number;
}

/** get_fb_linkedin */
export interface GetFbLinkedinStats {
  checked: number;
  updated: number;
  no_link_found: number;
  likely_js_rendered: number;
  fetch_failed: number;
  challenge_page: number;
  found_via_subpage: number;
  linkedin_personal_only_skipped: number;
  website_is_social_domain: number;
}

/**
 * check_expired_jobs. `needs_manual_check` (backend đã đổi từ khoá tiếng Việt
 * có dấu "cần_kiểm_tra_tay" sang snake_case, đồng bộ mọi khoá khác).
 * `expired_by_*` đếm theo JOB; `listings_expired_by_*`, `still_alive`,
 * `needs_manual_check` đếm theo LISTING (một job có thể có nhiều listing).
 * Với dry_run=true, các số này là số job/listing SẼ bị đóng, không ghi DB.
 */
export interface CheckExpiredJobsStats {
  checked: number;
  expired_by_source_dead: number;
  expired_by_deadline: number;
  listings_expired_by_deadline: number;
  listings_expired_by_source_dead: number;
  still_alive: number;
  needs_manual_check: number;
  cv_cleaned: number;
  cv_cleanup_errors: number;
}

export interface MaintenanceStatsByJobType {
  backfill_company_profiles: BackfillCompanyProfilesStats;
  enrich_profile_from_website: EnrichProfileFromWebsiteStats;
  enrich_web_info: EnrichWebInfoStats;
  get_fb_linkedin: GetFbLinkedinStats;
  check_expired_jobs: CheckExpiredJobsStats;
}

/** 1 run đã gắn kiểu `stats` theo đúng job_type. `stats` null cho tới khi xong. */
export type MaintenanceRun<T extends MaintenanceJobType = MaintenanceJobType> = Omit<
  MaintenanceStatus,
  "job_type" | "stats"
> & {
  job_type: T;
  stats?: MaintenanceStatsByJobType[T] | null;
};

/** Union phân biệt theo `job_type` — `switch (run.job_type)` thu hẹp được `run.stats`. */
export type AnyMaintenanceRun = { [K in MaintenanceJobType]: MaintenanceRun<K> }[MaintenanceJobType];

/**
 * Gắn kiểu cho response thô của backend. Trả null nếu `job_type` lạ (backend
 * thêm job thứ 6 mà frontend chưa cập nhật) — nơi gọi nên bỏ qua/ghi nhận
 * thay vì làm hỏng cả trang.
 */
export function narrowMaintenanceRun(raw: MaintenanceStatus): AnyMaintenanceRun | null {
  return isMaintenanceJobType(raw.job_type) ? (raw as AnyMaintenanceRun) : null;
}

/** Run còn đang chạy — dùng để quyết định có polling tiếp. */
export function isMaintenanceRunActive(status: string): boolean {
  return status === "queued" || status === "running";
}
