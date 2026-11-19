// lib/data-ops/crawl-ui.ts
// Nhãn tiếng Việt + tóm tắt số liệu của run crawl/bảo trì cho giao diện /crawl. Thuần (không gọi mạng).

import { readCrawlStats, type CrawlRun, type CrawlRunStatus } from "@/lib/data-ops/crawl";
import {
  narrowMaintenanceRun,
  type MaintenanceJobType,
  type MaintenanceStatus,
} from "@/lib/data-ops/maintenance";

export const RUN_STATUS_LABELS: Record<CrawlRunStatus, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  done: "Hoàn tất",
  error: "Lỗi",
};

/** Trạng thái lạ (backend thêm mới) hiện nguyên văn thay vì làm vỡ giao diện. */
export function runStatusLabel(status: string): string {
  return (RUN_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export const MAINTENANCE_JOB_LABELS: Record<MaintenanceJobType, string> = {
  backfill_company_profiles: "Vá hồ sơ công ty",
  enrich_profile_from_website: "Bổ sung hồ sơ từ website",
  enrich_web_info: "Tìm thông tin công ty trên web",
  get_fb_linkedin: "Tìm Facebook/LinkedIn công ty",
  check_expired_jobs: "Kiểm tra job hết hạn",
};

export function maintenanceJobLabel(jobType: string): string {
  return (MAINTENANCE_JOB_LABELS as Record<string, string>)[jobType] ?? jobType;
}

/** "45 giây" / "3 phút 05 giây" / "1 giờ 02 phút"; thiếu mốc hoặc sai thứ tự -> null. */
export function formatDuration(startedAt: string | null | undefined, finishedAt: string | null | undefined): string | null {
  if (!startedAt || !finishedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  const total = Math.round((end - start) / 1000);
  if (total < 60) return `${total} giây`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes} phút ${String(seconds).padStart(2, "0")} giây`;
  const hours = Math.floor(minutes / 60);
  return `${hours} giờ ${String(minutes % 60).padStart(2, "0")} phút`;
}

function join(parts: Array<[string, number | undefined]>): string {
  return parts
    .filter((p): p is [string, number] => typeof p[1] === "number")
    .map(([label, n]) => `${label} ${n}`)
    .join(" · ");
}

/**
 * Tóm tắt 1 dòng cho bảng lịch sử crawl. Chưa có `stats` (đang chạy, hoặc lỗi trước khi ghi stats) -> null.
 * Các khoá optional của CrawlStats chỉ xuất hiện khi > 0 nên "Trùng" cộng cả tin đăng lại.
 */
export function crawlStatsSummary(run: Pick<CrawlRun, "stats">): string | null {
  const stats = readCrawlStats(run);
  if (!stats) return null;
  const duplicates =
    typeof stats.skipped_duplicate === "number" || typeof stats.skipped_duplicate_repost === "number"
      ? (stats.skipped_duplicate ?? 0) + (stats.skipped_duplicate_repost ?? 0)
      : undefined;
  const base = join([
    ["Tải", stats.fetched],
    ["Thêm mới", stats.inserted],
    ["Cập nhật", stats.updated_existing],
    ["Trùng", duplicates],
    ["Lỗi", stats.errors],
  ]);
  const flags: string[] = [];
  if (stats.blocked) flags.push("Bị chặn");
  if (stats.degraded) flags.push("Dữ liệu nghi hỏng");
  return [base, ...flags].filter(Boolean).join(" · ") || null;
}

/**
 * Tóm tắt 1 dòng cho bảng lịch sử bảo trì. `stats` có 5 hình dạng khác nhau (không gộp chung một
 * interface toàn field optional), nên mỗi job_type chọn đúng các số liệu của nó.
 */
export function maintenanceStatsSummary(run: MaintenanceStatus): string | null {
  const typed = narrowMaintenanceRun(run);
  if (!typed || !typed.stats) return null;
  switch (typed.job_type) {
    case "backfill_company_profiles": {
      const s = typed.stats;
      return join([["Kiểm tra", s.checked], ["Cập nhật", s.updated], ["Không đổi", s.unchanged], ["Thiếu domain", s.unknown_domain], ["Lỗi", s.errors]]);
    }
    case "enrich_profile_from_website": {
      const s = typed.stats;
      return join([["Kiểm tra", s.checked], ["Cập nhật", s.updated], ["Không có nội dung", s.no_page_content], ["Độ tin cậy thấp", s.low_confidence], ["Lỗi", s.errors]]);
    }
    case "enrich_web_info": {
      const s = typed.stats;
      return join([["Kiểm tra", s.checked], ["Cập nhật", s.updated], ["Không có kết quả", s.no_result], ["Gộp công ty trùng", s.merged_duplicate_company], ["Lỗi", s.errors]]);
    }
    case "get_fb_linkedin": {
      const s = typed.stats;
      return join([["Kiểm tra", s.checked], ["Cập nhật", s.updated], ["Không thấy link", s.no_link_found], ["Tải lỗi", s.fetch_failed]]);
    }
    case "check_expired_jobs": {
      const s = typed.stats;
      return join([
        ["Kiểm tra", s.checked],
        ["Đóng do nguồn chết", s.expired_by_source_dead],
        ["Đóng do quá hạn", s.expired_by_deadline],
        ["Còn sống", s.still_alive],
        ["Cần kiểm tay", s.needs_manual_check],
      ]);
    }
  }
}

/** Mô tả tham số của lượt bảo trì (`params`) cho cột "Tham số". Rỗng -> null. */
export function maintenanceParamsSummary(params: Record<string, unknown> | null | undefined): string | null {
  if (!params) return null;
  const parts: string[] = [];
  if (typeof params.limit === "number") parts.push(`Giới hạn ${params.limit}`);
  if (params.dry_run === true) parts.push("Chạy thử (không ghi)");
  if (params.check_deadline_only === true) parts.push("Chỉ kiểm hạn");
  return parts.length ? parts.join(" · ") : null;
}
