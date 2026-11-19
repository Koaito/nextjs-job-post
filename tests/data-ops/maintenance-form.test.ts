import { describe, expect, it } from "vitest";
import { MAINTENANCE_JOB_TYPES, MAINTENANCE_LIMIT_MAX } from "@/lib/data-ops/maintenance";
import {
  maintenanceTriggerErrorMessage,
  validateMaintenanceBody,
  validateMaintenanceForm,
} from "@/lib/data-ops/maintenance-form";

const form = (over: Partial<Parameters<typeof validateMaintenanceForm>[0]> = {}) =>
  validateMaintenanceForm({ jobType: "backfill_company_profiles", limitText: "", dryRun: false, checkDeadlineOnly: false, ...over });

describe("validateMaintenanceForm", () => {
  it("job thường: limit rỗng -> request rỗng (backend chạy hết)", () => {
    expect(form()).toEqual({ ok: true, request: {} });
  });
  it("job thường: limit hợp lệ được gửi, có cắt khoảng trắng", () => {
    expect(form({ limitText: " 50 " })).toEqual({ ok: true, request: { limit: 50 } });
  });
  it("job tốn phí (enrich_web_info): thiếu limit -> lỗi, KHÔNG có request", () => {
    const r = form({ jobType: "enrich_web_info" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.limit).toMatch(/bắt buộc/);
  });
  it("job tốn phí có limit -> ok", () => {
    expect(form({ jobType: "enrich_web_info", limitText: "20" })).toEqual({ ok: true, request: { limit: 20 } });
  });
  it("biên limit 1..5000; số thập phân, chữ, âm, 0 đều bị từ chối", () => {
    expect(form({ limitText: "1" }).ok).toBe(true);
    expect(form({ limitText: String(MAINTENANCE_LIMIT_MAX) }).ok).toBe(true);
    for (const bad of ["0", "5001", "-3", "1.5", "abc", "1e3", "12345678"]) {
      const r = form({ limitText: bad });
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.errors.limit, bad).toMatch(/từ 1 đến 5000/);
    }
  });
  it("check_expired_jobs: chỉ gửi dry_run/check_deadline_only khi được tick (true), không gửi false", () => {
    expect(form({ jobType: "check_expired_jobs" })).toEqual({ ok: true, request: {} });
    expect(form({ jobType: "check_expired_jobs", dryRun: true })).toEqual({ ok: true, request: { dry_run: true } });
    expect(form({ jobType: "check_expired_jobs", dryRun: true, checkDeadlineOnly: true, limitText: "9" })).toEqual({
      ok: true,
      request: { limit: 9, dry_run: true, check_deadline_only: true },
    });
  });
  it("job khác check_expired_jobs: dry_run/check_deadline_only bị bỏ dù state còn tick (backend sẽ 400 nếu gửi)", () => {
    for (const jobType of MAINTENANCE_JOB_TYPES.filter((t) => t !== "check_expired_jobs")) {
      const r = form({ jobType, limitText: "5", dryRun: true, checkDeadlineOnly: true });
      expect(r, jobType).toEqual({ ok: true, request: { limit: 5 } });
    }
  });
});

describe("validateMaintenanceBody (route, không tin client)", () => {
  it("job_type lạ -> message", () => {
    expect(validateMaintenanceBody("new_job", {})).toHaveProperty("message");
    expect(validateMaintenanceBody("runs", {})).toHaveProperty("message");
    expect(validateMaintenanceBody("", {})).toHaveProperty("message");
  });
  it("body không phải object / mảng / null -> message", () => {
    for (const body of [null, [], "x", 5, undefined]) {
      expect(validateMaintenanceBody("backfill_company_profiles", body)).toHaveProperty("message");
    }
  });
  it("body rỗng hợp lệ với job thường", () => {
    expect(validateMaintenanceBody("get_fb_linkedin", {})).toEqual({ jobType: "get_fb_linkedin", request: {} });
  });
  it("trường lạ bị từ chối (backend extra=forbid)", () => {
    expect(validateMaintenanceBody("get_fb_linkedin", { evil: 1 })).toHaveProperty("message");
    expect(validateMaintenanceBody("get_fb_linkedin", { limit: 3, source: "x" })).toHaveProperty("message");
  });
  it("limit phải là số nguyên trong biên, đúng kiểu số (không nhận chuỗi)", () => {
    for (const bad of ["5", 0, 5001, 1.5, true, [], {}]) {
      expect(validateMaintenanceBody("get_fb_linkedin", { limit: bad }), String(bad)).toHaveProperty("message");
    }
    expect(validateMaintenanceBody("get_fb_linkedin", { limit: 5000 })).toEqual({
      jobType: "get_fb_linkedin",
      request: { limit: 5000 },
    });
  });
  it("enrich_web_info: thiếu limit (kể cả limit:null) -> message, không đụng backend", () => {
    expect(validateMaintenanceBody("enrich_web_info", {})).toHaveProperty("message");
    expect(validateMaintenanceBody("enrich_web_info", { limit: null })).toHaveProperty("message");
    expect(validateMaintenanceBody("enrich_web_info", { limit: 10 })).toEqual({
      jobType: "enrich_web_info",
      request: { limit: 10 },
    });
  });
  it("dry_run/check_deadline_only: nhận cho check_expired_jobs, đúng kiểu boolean", () => {
    expect(validateMaintenanceBody("check_expired_jobs", { dry_run: true, check_deadline_only: false })).toEqual({
      jobType: "check_expired_jobs",
      request: { dry_run: true, check_deadline_only: false },
    });
    expect(validateMaintenanceBody("check_expired_jobs", { dry_run: "true" })).toHaveProperty("message");
    expect(validateMaintenanceBody("check_expired_jobs", { dry_run: 1 })).toHaveProperty("message");
  });
  it("dry_run/check_deadline_only gửi cho job khác bị chặn, KỂ CẢ giá trị false", () => {
    for (const jobType of MAINTENANCE_JOB_TYPES.filter((t) => t !== "check_expired_jobs")) {
      const limit = jobType === "enrich_web_info" ? { limit: 5 } : {};
      expect(validateMaintenanceBody(jobType, { ...limit, dry_run: false }), jobType).toHaveProperty("message");
      expect(validateMaintenanceBody(jobType, { ...limit, check_deadline_only: true }), jobType).toHaveProperty("message");
    }
  });
  it("null coi như vắng mặt (backend cũng coi null là None)", () => {
    expect(validateMaintenanceBody("backfill_company_profiles", { limit: null, dry_run: null })).toEqual({
      jobType: "backfill_company_profiles",
      request: {},
    });
  });
});

describe("maintenanceTriggerErrorMessage", () => {
  it("409 theo status hoặc theo error_code", () => {
    expect(maintenanceTriggerErrorMessage(409)).toMatch(/chạy dở/);
    expect(maintenanceTriggerErrorMessage(500, "maintenance_already_active")).toMatch(/chạy dở/);
  });
  it("429 rẽ theo status (backend không có error_code)", () => {
    expect(maintenanceTriggerErrorMessage(429)).toMatch(/10 lượt/);
  });
  it("401, 403, 413, mạng, 5xx", () => {
    expect(maintenanceTriggerErrorMessage(401)).toMatch(/hết hạn/);
    expect(maintenanceTriggerErrorMessage(403)).toMatch(/admin/);
    expect(maintenanceTriggerErrorMessage(413)).toMatch(/quá lớn/);
    expect(maintenanceTriggerErrorMessage(0)).toMatch(/kết nối/);
    expect(maintenanceTriggerErrorMessage(503)).toMatch(/sự cố/);
  });
  it("400 dùng message backend làm fallback, không có thì câu mặc định", () => {
    expect(maintenanceTriggerErrorMessage(400, undefined, "Job gọi Tavily: bắt buộc limit")).toBe("Job gọi Tavily: bắt buộc limit");
    expect(maintenanceTriggerErrorMessage(400)).toMatch(/kiểm tra lại/);
  });
});
