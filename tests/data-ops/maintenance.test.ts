import { describe, expect, it } from "vitest";
import {
  MAINTENANCE_DRY_RUN_JOB_TYPE,
  MAINTENANCE_JOB_TYPES,
  MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT,
  MAINTENANCE_LIMIT_MAX,
  MAINTENANCE_LIMIT_MIN,
  isMaintenanceJobType,
  isMaintenanceRunActive,
  maintenanceRequiresLimit,
  maintenanceSupportsDryRun,
  narrowMaintenanceRun,
  type MaintenanceStatus,
} from "@/lib/data-ops/maintenance";

describe("isMaintenanceJobType", () => {
  it("nhận đủ các job_type đã khai báo", () => {
    for (const t of MAINTENANCE_JOB_TYPES) expect(isMaintenanceJobType(t)).toBe(true);
  });
  it("từ chối giá trị lạ", () => {
    expect(isMaintenanceJobType("new_job")).toBe(false);
    expect(isMaintenanceJobType("")).toBe(false);
    expect(isMaintenanceJobType("CHECK_EXPIRED_JOBS")).toBe(false);
  });
});

describe("maintenanceRequiresLimit", () => {
  it("hiện chỉ enrich_web_info bắt buộc limit (job tốn phí Tavily/Gemini)", () => {
    expect(maintenanceRequiresLimit("enrich_web_info")).toBe(true);
    for (const t of MAINTENANCE_JOB_TYPES) {
      expect(maintenanceRequiresLimit(t)).toBe(t === "enrich_web_info");
    }
  });

  it("mọi job bắt buộc limit đều là job_type hợp lệ", () => {
    for (const t of MAINTENANCE_JOB_TYPES_REQUIRE_LIMIT) expect(isMaintenanceJobType(t)).toBe(true);
  });
});

describe("maintenanceSupportsDryRun", () => {
  it("chỉ check_expired_jobs nhận dry_run", () => {
    expect(MAINTENANCE_DRY_RUN_JOB_TYPE).toBe("check_expired_jobs");
    for (const t of MAINTENANCE_JOB_TYPES) {
      expect(maintenanceSupportsDryRun(t)).toBe(t === "check_expired_jobs");
    }
  });
});

describe("biên limit", () => {
  it("1..5000 khớp backend", () => {
    expect(MAINTENANCE_LIMIT_MIN).toBe(1);
    expect(MAINTENANCE_LIMIT_MAX).toBe(5000);
  });
});

describe("isMaintenanceRunActive", () => {
  it("queued/running là đang chạy; còn lại là đã xong", () => {
    expect(isMaintenanceRunActive("queued")).toBe(true);
    expect(isMaintenanceRunActive("running")).toBe(true);
    expect(isMaintenanceRunActive("done")).toBe(false);
    expect(isMaintenanceRunActive("error")).toBe(false);
  });
});

describe("narrowMaintenanceRun", () => {
  const raw = (job_type: string) => ({ job_type, status: "done", stats: { checked: 1 } }) as unknown as MaintenanceStatus;

  it("job_type hợp lệ -> trả lại chính run đó", () => {
    const r = raw("check_expired_jobs");
    expect(narrowMaintenanceRun(r)).toBe(r);
  });

  it("job_type lạ (backend thêm job mới) -> null thay vì làm hỏng trang", () => {
    expect(narrowMaintenanceRun(raw("brand_new_job"))).toBeNull();
  });
});
