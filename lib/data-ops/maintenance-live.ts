// lib/data-ops/maintenance-live.ts
// Phần THUẦN của khối "đang chạy / log live / kết quả" ở tab Bảo trì (Nhóm 6 phần 3d). Không gọi mạng.
//
// Khác tab Crawl: có 5 job, mỗi job một khung log và một shape `stats` riêng, nên:
//   - trạng thái cả 5 job lấy bằng MỘT lời gọi latest-runs (run gần nhất của mỗi job);
//   - log cả 5 khung lấy bằng MỘT lời gọi logs-batch (không phải 5 vòng poll riêng).
// Các hàm dưới đây quyết định "hỏi log của run nào, từ id nào" và gộp phản hồi vào state, để component chỉ nối dây.

import { appendLogs } from "@/lib/data-ops/crawl-live";
import {
  MAINTENANCE_JOB_TYPES,
  isMaintenanceRunActive,
  maintenanceRequiresLimit,
  type AnyMaintenanceRun,
  type MaintenanceJobType,
  type MaintenanceLogLine,
  type MaintenanceLogs,
} from "@/lib/data-ops/maintenance";

export type LatestMaintenanceRuns = Record<MaintenanceJobType, AnyMaintenanceRun | null>;

// ---------------------------------------------------------------------------
// Mô tả từng job (hiện trên thẻ)
// ---------------------------------------------------------------------------

export const MAINTENANCE_JOB_DESCRIPTIONS: Record<MaintenanceJobType, string> = {
  backfill_company_profiles: "Vá hồ sơ công ty còn thiếu từ dữ liệu đã có (domain, website). Không gọi dịch vụ tốn phí.",
  enrich_profile_from_website: "Đọc website công ty rồi dùng Gemini bổ sung ngành nghề, sản phẩm và dịch vụ.",
  enrich_web_info: "Tra website và mã số thuế công ty qua Tavily và Gemini.",
  get_fb_linkedin: "Tìm link Facebook/LinkedIn của công ty từ website đã có. Chỉ tải HTML, không tốn phí.",
  check_expired_jobs: "Kiểm tra job còn hạn hay đã chết nguồn, đóng job hết hạn. Có thể chạy thử để xem trước.",
};

/** Job gọi dịch vụ tốn phí thật. Suy ra từ quy tắc bắt buộc limit của backend, không hard-code theo tên job. */
export function isCostlyMaintenanceJob(jobType: MaintenanceJobType): boolean {
  return maintenanceRequiresLimit(jobType);
}

// ---------------------------------------------------------------------------
// Số liệu kết quả: 5 shape khác hẳn nhau
// ---------------------------------------------------------------------------

export interface MaintenanceTile {
  key: string;
  label: string;
  value: number;
}

/** Khoá thiếu/không phải số -> 0: không bao giờ hiện "undefined"/NaN. */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function tiles(stats: object, spec: Array<[string, string]>): MaintenanceTile[] {
  const s = stats as Record<string, unknown>;
  return spec.map(([key, label]) => ({ key, label, value: num(s[key]) }));
}

/**
 * Các ô số liệu của một lượt đã xong, ĐÚNG theo job_type của lượt đó. Chưa có stats (đang chạy, hoặc lỗi trước khi
 * ghi) -> []. Dùng switch trên `run.job_type` để TypeScript thu hẹp `run.stats`: thêm job mới mà quên ở đây là lỗi biên dịch.
 */
export function maintenanceResultTiles(run: AnyMaintenanceRun): MaintenanceTile[] {
  if (!run.stats) return [];
  switch (run.job_type) {
    case "backfill_company_profiles":
      return tiles(run.stats, [
        ["checked", "Đã kiểm tra"],
        ["updated", "Đã cập nhật"],
        ["unchanged", "Không đổi"],
        ["unknown_domain", "Thiếu domain"],
        ["errors", "Lỗi"],
      ]);
    case "enrich_profile_from_website":
      return tiles(run.stats, [
        ["checked", "Đã kiểm tra"],
        ["updated", "Đã cập nhật"],
        ["industry_updated", "Cập nhật ngành"],
        ["products_services_updated", "Cập nhật sản phẩm/dịch vụ"],
        ["no_page_content", "Không có nội dung"],
        ["low_confidence", "Độ tin cậy thấp"],
        ["fetch_failed", "Tải trang lỗi"],
        ["errors", "Lỗi"],
      ]);
    case "enrich_web_info":
      return tiles(run.stats, [
        ["checked", "Đã kiểm tra"],
        ["updated", "Đã cập nhật"],
        ["no_result", "Không có kết quả"],
        ["website_name_mismatch", "Tên website lệch"],
        ["merged_duplicate_company", "Gộp công ty trùng"],
        ["errors", "Lỗi"],
      ]);
    case "get_fb_linkedin":
      return tiles(run.stats, [
        ["checked", "Đã kiểm tra"],
        ["updated", "Đã cập nhật"],
        ["found_via_subpage", "Tìm thấy ở trang con"],
        ["no_link_found", "Không thấy link"],
        ["likely_js_rendered", "Trang render bằng JS"],
        ["challenge_page", "Gặp trang chặn"],
        ["fetch_failed", "Tải trang lỗi"],
        ["linkedin_personal_only_skipped", "Bỏ (LinkedIn cá nhân)"],
        ["website_is_social_domain", "Website là mạng xã hội"],
      ]);
    case "check_expired_jobs":
      return tiles(run.stats, [
        ["checked", "Đã kiểm tra"],
        ["expired_by_source_dead", "Đóng: nguồn chết"],
        ["expired_by_deadline", "Đóng: quá hạn"],
        ["listings_expired_by_source_dead", "Listing: nguồn chết"],
        ["listings_expired_by_deadline", "Listing: quá hạn"],
        ["still_alive", "Còn sống"],
        ["needs_manual_check", "Cần kiểm tay"],
        ["cv_cleaned", "CV đã dọn"],
        ["cv_cleanup_errors", "Lỗi dọn CV"],
      ]);
  }
}

/** Ghi chú cạnh kết quả. Lượt chạy thử (dry_run) phải nói rõ là chưa ghi gì, kẻo đọc nhầm là đã đóng job thật. */
export function maintenanceResultNotes(run: Pick<AnyMaintenanceRun, "params" | "status">): string[] {
  const notes: string[] = [];
  if (run.status === "done" && run.params && (run.params as Record<string, unknown>).dry_run === true) {
    notes.push("Lượt chạy thử: các số là số job SẼ bị đóng, chưa ghi gì vào cơ sở dữ liệu.");
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Trạng thái chung
// ---------------------------------------------------------------------------

/** Có job nào còn queued/running (còn lý do để poll). */
export function anyMaintenanceActive(runs: Partial<LatestMaintenanceRuns> | undefined | null): boolean {
  if (!runs) return false;
  return MAINTENANCE_JOB_TYPES.some((t) => {
    const run = runs[t];
    return Boolean(run) && isMaintenanceRunActive(run!.status);
  });
}

// ---------------------------------------------------------------------------
// Log live gộp (logs-batch)
// ---------------------------------------------------------------------------

export interface RunLogState {
  lines: MaintenanceLogLine[];
  /** Đã đọc tới log id nào (last_id lớn nhất đã thấy). */
  afterId: number;
  /**
   * Đã lấy trọn: lượt KHÔNG còn chạy và một lần hỏi sau đó trả rỗng. Đòi hỏi lần trả rỗng (không chỉ "lượt đã xong")
   * để không bỏ sót dòng log cuối khi trạng thái xong tới trước phản hồi log cuối.
   */
  settled: boolean;
}

export type LogsByRun = Record<string, RunLogState>;

export interface LogCursor {
  runId: string;
  afterId: number;
}

/**
 * Hỏi log của run nào, từ id nào: mọi run hiện tại CHƯA settled (lượt đang chạy, hoặc chưa từng tải lần nào, hoặc
 * vừa xong còn dòng cuối). Thứ tự theo MAINTENANCE_JOB_TYPES nên ổn định giữa các lần gọi (URL không nhảy vô cớ).
 */
export function planLogCursors(runs: Partial<LatestMaintenanceRuns>, logs: LogsByRun): LogCursor[] {
  const out: LogCursor[] = [];
  for (const jobType of MAINTENANCE_JOB_TYPES) {
    const run = runs[jobType];
    if (!run) continue;
    const state = logs[run.run_id];
    if (state?.settled) continue;
    out.push({ runId: run.run_id, afterId: state?.afterId ?? 0 });
  }
  return out;
}

/** URL gọi logs-batch từ danh sách cursor (hai chuỗi cùng sinh từ một mảng nên không thể lệch vị trí). Rỗng -> null (không gọi). */
export function logsBatchUrl(cursors: LogCursor[]): string | null {
  if (cursors.length === 0) return null;
  const runIds = cursors.map((c) => c.runId).join(",");
  const afterIds = cursors.map((c) => String(Math.max(0, Math.trunc(c.afterId)))).join(",");
  return `/api/maintenance/logs-batch?run_ids=${runIds}&after_ids=${afterIds}`;
}

/**
 * Gộp phản hồi logs-batch vào state. Khử trùng theo id và giữ tối đa LOG_LINE_CAP dòng mới nhất (appendLogs).
 * Run không còn là run gần nhất của job nào thì bị bỏ khỏi state (đã có lượt mới thay), tránh giữ log cũ mãi.
 * Run thiếu trong phản hồi (backend không trả) thì giữ nguyên state cũ.
 */
export function applyLogsBatch(
  logs: LogsByRun,
  runs: Partial<LatestMaintenanceRuns>,
  response: Record<string, MaintenanceLogs>,
): LogsByRun {
  const next: LogsByRun = {};
  for (const jobType of MAINTENANCE_JOB_TYPES) {
    const run = runs[jobType];
    if (!run) continue;
    const prev = logs[run.run_id];
    const got = response[run.run_id];
    if (!got) {
      if (prev) next[run.run_id] = prev;
      continue;
    }
    const lines = appendLogs(prev?.lines ?? [], got.items);
    const afterId = Math.max(prev?.afterId ?? 0, got.last_id);
    const settled = !isMaintenanceRunActive(run.status) && got.items.length === 0;
    next[run.run_id] = { lines, afterId, settled };
  }
  return next;
}
