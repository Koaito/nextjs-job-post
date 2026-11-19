import { beforeEach, describe, expect, it, vi } from "vitest";

const requireStaff = vi.fn();
const updateJobStatus = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/auth-guard", () => ({ requireStaff: () => requireStaff() }));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/api/jobs", () => ({ updateJobStatus: (...a: unknown[]) => updateJobStatus(...a) }));

import { ApiError } from "@/lib/api/client";
import { closeJobFromDataHealthAction } from "@/lib/actions/data-health-actions";
import { CLOSE_JOB_NOTES } from "@/lib/data-ops/data-health";

const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  requireStaff.mockReset();
  updateJobStatus.mockReset();
  revalidatePath.mockReset();
  requireStaff.mockResolvedValue({ role: "ss_team", is_staff: true });
});

describe("closeJobFromDataHealthAction", () => {
  it("kiểm quyền staff TRƯỚC mọi việc: không phải staff thì requireStaff ném (notFound) và không đụng backend", async () => {
    requireStaff.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(closeJobFromDataHealthAction(ID, "duplicate")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(updateJobStatus).not.toHaveBeenCalled();
  });

  it("id không phải UUID hoặc loại lạ -> từ chối, không gọi backend (action gọi tay được)", async () => {
    for (const [id, kind] of [
      ["abc", "duplicate"],
      ["", "duplicate"],
      [`${ID}; DROP`, "expired"],
      [ID, "evil"],
      [ID, "constructor"],
      [ID, ""],
    ] as const) {
      const res = await closeJobFromDataHealthAction(id, kind);
      expect(res.ok, `${id}|${kind}`).toBe(false);
    }
    expect(updateJobStatus).not.toHaveBeenCalled();
  });

  it("bảng nhóm trùng: đóng bằng ĐÚNG câu cố định của bảng trùng", async () => {
    updateJobStatus.mockResolvedValue({});
    const res = await closeJobFromDataHealthAction(ID, "duplicate");
    expect(res).toEqual({ ok: true, message: "Đã đóng job." });
    expect(updateJobStatus).toHaveBeenCalledWith(ID, "CLOSED", CLOSE_JOB_NOTES.duplicate);
  });

  it("bảng hết hạn: đóng bằng câu riêng của bảng hết hạn", async () => {
    updateJobStatus.mockResolvedValue({});
    await closeJobFromDataHealthAction(ID, "expired");
    expect(updateJobStatus).toHaveBeenCalledWith(ID, "CLOSED", CLOSE_JOB_NOTES.expired);
  });

  it("thành công làm mới trang /crawl, danh sách job và trang chi tiết job", async () => {
    updateJobStatus.mockResolvedValue({});
    await closeJobFromDataHealthAction(ID, "duplicate");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(["/crawl", "/jobs", `/jobs/${ID}`]));
  });

  it("404 (job đã mất): báo stale để nơi gọi tải lại danh sách", async () => {
    updateJobStatus.mockRejectedValue(new ApiError("Không tìm thấy job", 404, "job_job_not_found"));
    const res = await closeJobFromDataHealthAction(ID, "duplicate");
    expect(res).toMatchObject({ ok: false, stale: true });
    expect(res.message).toMatch(/không còn tồn tại/);
    expect(revalidatePath).toHaveBeenCalledWith("/crawl");
  });

  it("503 khoá chống trùng: dùng message backend, KHÔNG stale (job vẫn còn, thử lại được)", async () => {
    updateJobStatus.mockRejectedValue(new ApiError("Có thao tác khác đang ghi job cùng công ty.", 503, "job_dedup_lock_timeout"));
    const res = await closeJobFromDataHealthAction(ID, "expired");
    expect(res.ok).toBe(false);
    expect(res.stale).toBe(false);
    expect(res.message).toBe("Có thao tác khác đang ghi job cùng công ty.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lỗi không phải ApiError (mạng) -> thông báo chung, không lộ chi tiết", async () => {
    updateJobStatus.mockRejectedValue(new Error("ECONNRESET 10.0.0.5"));
    const res = await closeJobFromDataHealthAction(ID, "duplicate");
    expect(res).toMatchObject({ ok: false });
    expect(res.message).not.toMatch(/ECONNRESET|10\.0\.0\.5/);
  });
});
