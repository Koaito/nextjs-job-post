import { describe, expect, it, vi } from "vitest";

const endSessionIfNeeded = vi.fn();
vi.mock("@/lib/session-end-client", () => ({ endSessionIfNeeded: (...a: unknown[]) => endSessionIfNeeded(...a) }));

import { MaintenanceClientError, startMaintenanceRun } from "@/lib/data-ops/maintenance-client";

const json = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;

describe("startMaintenanceRun", () => {
  it("thành công trả runId/jobType và gửi đúng POST tới /api/maintenance/{jobType}", async () => {
    const fetcher = vi.fn(json(202, { ok: true, runId: "r1", jobType: "enrich_web_info" })) as unknown as typeof fetch;
    expect(await startMaintenanceRun("enrich_web_info", { limit: 10 }, fetcher)).toEqual({ runId: "r1", jobType: "enrich_web_info" });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/maintenance/enrich_web_info");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ limit: 10 });
  });
  it("409 -> MaintenanceClientError với message tiếng Việt, kèm status và code", async () => {
    const err = await startMaintenanceRun(
      "check_expired_jobs",
      {},
      json(409, { ok: false, message: "x", errorCode: "maintenance_already_active" }),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(MaintenanceClientError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("maintenance_already_active");
    expect(err.message).toMatch(/chạy dở/);
  });
  it("429 và 403 rẽ nhánh theo status", async () => {
    expect((await startMaintenanceRun("get_fb_linkedin", {}, json(429, { ok: false })).catch((e) => e)).message).toMatch(/10 lượt/);
    expect((await startMaintenanceRun("get_fb_linkedin", {}, json(403, { ok: false })).catch((e) => e)).message).toMatch(/admin/);
  });
  it("body không phải JSON (HTML 502) vẫn ra thông báo đúng theo status", async () => {
    const html = (async () => new Response("<html>Bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
    const err = await startMaintenanceRun("get_fb_linkedin", {}, html).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/sự cố/);
  });
  it("200 nhưng body thiếu runId -> coi là lỗi, không báo thành công giả", async () => {
    const err = await startMaintenanceRun("get_fb_linkedin", {}, json(200, { ok: true })).catch((e) => e);
    expect(err).toBeInstanceOf(MaintenanceClientError);
  });
  it("200 nhưng thiếu riêng runId hoặc riêng jobType -> cũng là lỗi", async () => {
    for (const body of [{ ok: true, jobType: "get_fb_linkedin" }, { ok: true, runId: "r1" }, { ok: true, runId: 5, jobType: "x" }]) {
      const err = await startMaintenanceRun("get_fb_linkedin", {}, json(200, body)).catch((e) => e);
      expect(err, JSON.stringify(body)).toBeInstanceOf(MaintenanceClientError);
    }
  });
  it("lỗi mạng -> status 0", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await startMaintenanceRun("get_fb_linkedin", {}, down).catch((e) => e);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/kết nối/);
  });
  it("401 báo cho cơ chế phiên kết thúc kèm error_code", async () => {
    endSessionIfNeeded.mockClear();
    await startMaintenanceRun("get_fb_linkedin", {}, json(401, { ok: false, errorCode: "session_replaced" })).catch(() => undefined);
    expect(endSessionIfNeeded).toHaveBeenCalledWith(401, "session_replaced");
  });
});
