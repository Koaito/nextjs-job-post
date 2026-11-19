import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const triggerCrawlBatch = vi.fn();
const verifyOrigin = vi.fn();

vi.mock("@/lib/session", () => ({ getCurrentUser: () => getCurrentUser(), getSessionToken: async () => "tok" }));
vi.mock("@/lib/verify-origin", () => ({ verifyOrigin: (...a: unknown[]) => verifyOrigin(...a) }));
vi.mock("@/lib/api/crawl", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/crawl")>()),
  triggerCrawlBatch: (...a: unknown[]) => triggerCrawlBatch(...a),
}));

import { ApiError } from "@/lib/api/client";
import { POST } from "@/app/api/crawl/batch/route";

const post = (body: unknown, raw?: string) =>
  new Request("http://localhost/api/crawl/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  }) as never;

const GOOD = { source: "topcv", categories: ["data-analyst"], pages: 2 };

beforeEach(() => {
  getCurrentUser.mockReset();
  triggerCrawlBatch.mockReset();
  verifyOrigin.mockReset();
  verifyOrigin.mockReturnValue({ ok: true });
  getCurrentUser.mockResolvedValue({ role: "admin", is_staff: true });
});

describe("POST /api/crawl/batch — phân quyền (chỉ ADMIN)", () => {
  it("nguồn lạ -> 403, không đụng backend", async () => {
    verifyOrigin.mockReturnValue({ ok: false });
    const res = await POST(post(GOOD));
    expect(res.status).toBe(403);
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(triggerCrawlBatch).not.toHaveBeenCalled();
  });
  it("chưa đăng nhập -> 401 JSON thật", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(post(GOOD));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("staff ss_team và học viên -> 403 (xem trang được nhưng không được chạy)", async () => {
    for (const role of ["ss_team", "user"]) {
      getCurrentUser.mockResolvedValue({ role, is_staff: role !== "user" });
      expect((await POST(post(GOOD))).status).toBe(403);
    }
    expect(triggerCrawlBatch).not.toHaveBeenCalled();
  });
});

describe("POST /api/crawl/batch — body", () => {
  it("JSON hỏng, thiếu category, trường lạ, vượt biên -> 400, không gọi backend", async () => {
    expect((await POST(post(null, "{không phải json"))).status).toBe(400);
    expect((await POST(post({ source: "topcv", categories: [] }))).status).toBe(400);
    expect((await POST(post({ ...GOOD, evil: 1 }))).status).toBe(400);
    expect((await POST(post({ ...GOOD, pages: 99 }))).status).toBe(400);
    expect(triggerCrawlBatch).not.toHaveBeenCalled();
  });
  it("body quá to -> 413", async () => {
    const res = await POST(post({ source: "topcv", categories: ["a"], pad: "x".repeat(5000) }));
    expect(res.status).toBe(413);
    expect(triggerCrawlBatch).not.toHaveBeenCalled();
  });
});

describe("POST /api/crawl/batch — kích hoạt", () => {
  it("thành công: 202 + batchId/firstRunId, gửi đúng request đã chuẩn hoá", async () => {
    triggerCrawlBatch.mockResolvedValue({ batch_id: "b1", first_run_id: "r1", status: "running" });
    const res = await POST(post(GOOD));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, batchId: "b1", firstRunId: "r1" });
    expect(triggerCrawlBatch).toHaveBeenCalledWith({ source: "topcv", categories: ["data-analyst"], pages: 2 });
  });
  it("409 crawl_already_active: giữ status + errorCode, message tiếng Việt", async () => {
    triggerCrawlBatch.mockRejectedValue(new ApiError("Source topcv đang chạy", 409, "crawl_already_active"));
    const res = await POST(post(GOOD));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("crawl_already_active");
    expect(body.message).toMatch(/chạy dở/);
  });
  it("429 (không có error_code) -> 429 với thông báo giới hạn", async () => {
    triggerCrawlBatch.mockRejectedValue(new ApiError("Too many", 429));
    const res = await POST(post(GOOD));
    expect(res.status).toBe(429);
    expect((await res.json()).message).toMatch(/10 lượt/);
  });
  it("400 backend (category không tồn tại) giữ message backend", async () => {
    triggerCrawlBatch.mockRejectedValue(new ApiError("Category ['x'] không tồn tại", 400, "crawl_not_found_3"));
    const res = await POST(post(GOOD));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("không tồn tại");
  });
  it("lỗi mạng -> 502; 401 từ backend giữ nguyên (client xử lý phiên)", async () => {
    triggerCrawlBatch.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect((await POST(post(GOOD))).status).toBe(502);
    triggerCrawlBatch.mockRejectedValueOnce(new ApiError("hết phiên", 401, "session_replaced"));
    const res = await POST(post(GOOD));
    expect(res.status).toBe(401);
    expect((await res.json()).errorCode).toBe("session_replaced");
  });
});
