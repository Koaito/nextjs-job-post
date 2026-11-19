import { describe, expect, it } from "vitest";
import {
  crawlStatsSummary,
  formatDuration,
  maintenanceJobLabel,
  maintenanceParamsSummary,
  maintenanceStatsSummary,
  runStatusLabel,
} from "@/lib/data-ops/crawl-ui";
import { MAINTENANCE_JOB_TYPES } from "@/lib/data-ops/maintenance";

describe("nhãn", () => {
  it("trạng thái và job có nhãn; giá trị lạ hiện nguyên văn", () => {
    expect(runStatusLabel("queued")).toBe("Đang chờ");
    expect(runStatusLabel("done")).toBe("Hoàn tất");
    expect(runStatusLabel("paused")).toBe("paused");
    for (const t of MAINTENANCE_JOB_TYPES) expect(maintenanceJobLabel(t)).not.toBe(t);
    expect(maintenanceJobLabel("job_moi")).toBe("job_moi");
  });
});

describe("formatDuration", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 16, 0, 0, s)).toISOString();
  it("giây / phút / giờ", () => {
    expect(formatDuration(at(0), at(45))).toBe("45 giây");
    expect(formatDuration(at(0), at(185))).toBe("3 phút 05 giây");
    expect(formatDuration(at(0), at(3725))).toBe("1 giờ 02 phút");
  });
  it("thiếu mốc, sai thứ tự hoặc không parse được -> null", () => {
    expect(formatDuration(at(0), null)).toBeNull();
    expect(formatDuration(undefined, at(5))).toBeNull();
    expect(formatDuration(at(10), at(5))).toBeNull();
    expect(formatDuration("không phải ngày", at(5))).toBeNull();
  });
});

describe("crawlStatsSummary", () => {
  it("chưa có stats -> null", () => {
    expect(crawlStatsSummary({ stats: null })).toBeNull();
    expect(crawlStatsSummary({})).toBeNull();
  });
  it("gộp trùng URL và tin đăng lại vào 'Trùng'", () => {
    const s = crawlStatsSummary({
      stats: { fetched: 40, inserted: 12, skipped_duplicate: 5, skipped_duplicate_repost: 2, errors: 1 },
    });
    expect(s).toBe("Tải 40 · Thêm mới 12 · Trùng 7 · Lỗi 1");
  });
  it("khoá optional thiếu không in 'undefined'/NaN", () => {
    const s = crawlStatsSummary({ stats: { fetched: 3, inserted: 0 } });
    expect(s).toBe("Tải 3 · Thêm mới 0");
    expect(s).not.toMatch(/undefined|NaN/);
  });
  it("cờ bị chặn / dữ liệu nghi hỏng được nêu rõ", () => {
    expect(crawlStatsSummary({ stats: { fetched: 1, blocked: true } })).toContain("Bị chặn");
    expect(crawlStatsSummary({ stats: { fetched: 1, degraded: { reasons: ["x"] } } })).toContain("Dữ liệu nghi hỏng");
  });
});

describe("maintenanceStatsSummary (5 hình dạng khác nhau)", () => {
  const run = (job_type: string, stats: unknown) =>
    ({ run_id: "r", job_type, status: "done", params: {}, started_at: "2026-11-16T00:00:00Z", stats }) as never;

  it("mỗi job chọn đúng số liệu của nó", () => {
    expect(
      maintenanceStatsSummary(run("backfill_company_profiles", { checked: 10, updated: 4, unchanged: 5, unknown_domain: 1, errors: 0 })),
    ).toBe("Kiểm tra 10 · Cập nhật 4 · Không đổi 5 · Thiếu domain 1 · Lỗi 0");
    expect(
      maintenanceStatsSummary(run("check_expired_jobs", { checked: 8, expired_by_source_dead: 2, expired_by_deadline: 1, still_alive: 4, needs_manual_check: 1 })),
    ).toBe("Kiểm tra 8 · Đóng do nguồn chết 2 · Đóng do quá hạn 1 · Còn sống 4 · Cần kiểm tay 1");
    expect(maintenanceStatsSummary(run("enrich_web_info", { checked: 5, updated: 2, no_result: 3, errors: 0, merged_duplicate_company: 1 }))).toContain(
      "Gộp công ty trùng 1",
    );
    expect(maintenanceStatsSummary(run("get_fb_linkedin", { checked: 5, updated: 2, no_link_found: 3, fetch_failed: 0 }))).toContain("Không thấy link 3");
    expect(maintenanceStatsSummary(run("enrich_profile_from_website", { checked: 5, updated: 2, no_page_content: 1, low_confidence: 1, errors: 0 }))).toContain(
      "Độ tin cậy thấp 1",
    );
  });
  it("chưa có stats hoặc job_type lạ -> null", () => {
    expect(maintenanceStatsSummary(run("check_expired_jobs", null))).toBeNull();
    expect(maintenanceStatsSummary(run("job_moi", { checked: 1 }))).toBeNull();
  });
});

describe("maintenanceParamsSummary", () => {
  it("mô tả tham số đã gửi; rỗng -> null", () => {
    expect(maintenanceParamsSummary({ limit: 50, dry_run: true })).toBe("Giới hạn 50 · Chạy thử (không ghi)");
    expect(maintenanceParamsSummary({ check_deadline_only: true })).toBe("Chỉ kiểm hạn");
    expect(maintenanceParamsSummary({})).toBeNull();
    expect(maintenanceParamsSummary(null)).toBeNull();
    expect(maintenanceParamsSummary({ dry_run: false })).toBeNull();
  });
});
