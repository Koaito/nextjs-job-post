import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const triggerMaintenanceRun = vi.fn();
const verifyOrigin = vi.fn();

vi.mock("@/lib/session", () => ({ getCurrentUser: () => getCurrentUser(), getSessionToken: async () => "tok" }));
vi.mock("@/lib/verify-origin", () => ({ verifyOrigin: (...a: unknown[]) => verifyOrigin(...a) }));
vi.mock("@/lib/api/maintenance", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/maintenance")>()),
  triggerMaintenanceRun: (...a: unknown[]) => triggerMaintenanceRun(...a),
}));

import { ApiError } from "@/lib/api/client";
import { POST } from "@/app/api/maintenance/[jobType]/route";

const call = (jobType: string, body: unknown, raw?: string) =>
  POST(
    new Request(`http://localhost/api/maintenance/${jobType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ jobType }) },
  );

beforeEach(() => {
  getCurrentUser.mockReset();
  triggerMaintenanceRun.mockReset();
  verifyOrigin.mockReset();
  verifyOrigin.mockReturnValue({ ok: true });
  getCurrentUser.mockResolvedValue({ role: "admin", is_staff: true });
});

describe("POST /api/maintenance/{jobType} — phân quyền (chỉ ADMIN)", () => {
  it("nguồn lạ -> 403, không đụng session lẫn backend", async () => {
    verifyOrigin.mockReturnValue({ ok: false });
    const res = await call("backfill_company_profiles", {});
    expect(res.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
  it("chưa đăng nhập -> 401 JSON thật, no-store", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await call("backfill_company_profiles", {});
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("staff ss_team và học viên -> 403 (xem được trang nhưng không được chạy)", async () => {
    for (const role of ["ss_team", "user"]) {
      getCurrentUser.mockResolvedValue({ role, is_staff: role !== "user" });
      expect((await call("backfill_company_profiles", {})).status).toBe(403);
    }
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
});

describe("POST /api/maintenance/{jobType} — job_type và body", () => {
  it("job_type lạ hoặc trùng tên route đọc (runs, latest-runs) -> 400, không đụng backend", async () => {
    for (const jobType of ["new_job", "runs", "latest-runs", "logs-batch"]) {
      expect((await call(jobType, {})).status, jobType).toBe(400);
    }
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
  it("JSON hỏng, trường lạ, limit vượt biên -> 400", async () => {
    expect((await call("get_fb_linkedin", null, "{không phải json")).status).toBe(400);
    expect((await call("get_fb_linkedin", { evil: 1 })).status).toBe(400);
    expect((await call("get_fb_linkedin", { limit: 99999 })).status).toBe(400);
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
  it("enrich_web_info thiếu limit -> 400 ngay ở route (tốn phí thật, không gọi backend)", async () => {
    const res = await call("enrich_web_info", {});
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/bắt buộc/);
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
  it("dry_run:false gửi cho job khác check_expired_jobs -> 400 (backend sẽ từ chối cả false)", async () => {
    expect((await call("get_fb_linkedin", { dry_run: false })).status).toBe(400);
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
  it("body quá to -> 413", async () => {
    expect((await call("get_fb_linkedin", { limit: 1, pad: "x".repeat(2000) })).status).toBe(413);
    expect(triggerMaintenanceRun).not.toHaveBeenCalled();
  });
});

describe("POST /api/maintenance/{jobType} — kích hoạt", () => {
  it("thành công: 202 + runId/jobType, gửi đúng job và request đã chuẩn hoá", async () => {
    triggerMaintenanceRun.mockResolvedValue({ run_id: "r1", job_type: "check_expired_jobs", status: "queued" });
    const res = await call("check_expired_jobs", { limit: 7, dry_run: true });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, runId: "r1", jobType: "check_expired_jobs" });
    expect(triggerMaintenanceRun).toHaveBeenCalledWith("check_expired_jobs", { limit: 7, dry_run: true });
  });
  it("body rỗng cho job thường: gọi backend với request rỗng", async () => {
    triggerMaintenanceRun.mockResolvedValue({ run_id: "r2", job_type: "get_fb_linkedin", status: "queued" });
    expect((await call("get_fb_linkedin", {})).status).toBe(202);
    expect(triggerMaintenanceRun).toHaveBeenCalledWith("get_fb_linkedin", {});
  });
  it("409 maintenance_already_active: giữ status + errorCode, message tiếng Việt", async () => {
    triggerMaintenanceRun.mockRejectedValue(new ApiError("đang chạy", 409, "maintenance_already_active"));
    const res = await call("check_expired_jobs", {});
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("maintenance_already_active");
    expect(body.message).toMatch(/chạy dở/);
  });
  it("429 (không có error_code) -> 429 với thông báo giới hạn", async () => {
    triggerMaintenanceRun.mockRejectedValue(new ApiError("Too many", 429));
    const res = await call("get_fb_linkedin", {});
    expect(res.status).toBe(429);
    expect((await res.json()).message).toMatch(/10 lượt/);
  });
  it("400 backend giữ message backend", async () => {
    triggerMaintenanceRun.mockRejectedValue(new ApiError("job_type không tồn tại", 400, "maintenance_job_not_found"));
    const res = await call("get_fb_linkedin", {});
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("không tồn tại");
  });
  it("lỗi mạng -> 502; 401 từ backend giữ nguyên (client xử lý phiên)", async () => {
    triggerMaintenanceRun.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect((await call("get_fb_linkedin", {})).status).toBe(502);
    triggerMaintenanceRun.mockRejectedValueOnce(new ApiError("hết phiên", 401, "session_replaced"));
    const res = await call("get_fb_linkedin", {});
    expect(res.status).toBe(401);
    expect((await res.json()).errorCode).toBe("session_replaced");
  });
});
