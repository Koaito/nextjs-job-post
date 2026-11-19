import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { loadSection } from "@/lib/load-section";

describe("loadSection", () => {
  it("thành công trả dữ liệu", async () => {
    expect(await loadSection(async () => 42)).toEqual({ ok: true, data: 42 });
  });

  it("401 ném tiếp nguyên vẹn, KHÔNG nuốt thành lỗi khối (phiên đã chết thì cả trang phải dừng)", async () => {
    const err = new ApiError("hết phiên", 401, "session_replaced");
    await expect(loadSection(async () => Promise.reject(err))).rejects.toBe(err);
  });

  it("các lỗi khác chỉ thành lỗi RIÊNG khối: 403, 404, 429, 5xx, mạng", async () => {
    for (const status of [403, 404, 429, 500, 503]) {
      const r = await loadSection(async () => Promise.reject(new ApiError(`lỗi ${status}`, status)));
      expect(r, String(status)).toEqual({ ok: false, message: `lỗi ${status}` });
    }
    expect(await loadSection(async () => Promise.reject(new TypeError("fetch failed")))).toEqual({
      ok: false,
      message: "Không tải được dữ liệu.",
    });
  });

  it("ApiError không có message dùng câu mặc định; câu mặc định đổi được", async () => {
    expect(await loadSection(async () => Promise.reject(new ApiError("", 500)))).toMatchObject({ message: "Không tải được dữ liệu." });
    expect(await loadSection(async () => Promise.reject(new Error("x")), "Câu riêng")).toMatchObject({ message: "Câu riêng" });
  });

  it("không lộ chi tiết lỗi không phải ApiError (vd chuỗi nội bộ) ra giao diện", async () => {
    const r = await loadSection(async () => Promise.reject(new Error("ECONNREFUSED 10.1.2.3:5432")));
    expect(JSON.stringify(r)).not.toMatch(/ECONNREFUSED|10\.1\.2\.3/);
  });
});

describe("nhiều lời gọi trong một lần dựng trang (ca '401 ở lệnh thứ 2')", () => {
  it("lời gọi đầu thành công, lời gọi thứ hai bị 401: cả trang ném 401, không ghép kết quả nửa vời", async () => {
    const dead = new ApiError("phiên bị thay thế", 401, "session_replaced");
    const page = Promise.all([
      loadSection(async () => "bảng crawl"),
      loadSection(async () => Promise.reject(dead)),
      loadSection(async () => "danh sách nguồn"),
    ]);
    await expect(page).rejects.toBe(dead);
  });

  it("401 ở lời gọi đầu hoặc cuối cũng vậy", async () => {
    const dead = new ApiError("hết hạn", 401);
    for (const order of [[0], [2], [0, 1, 2]]) {
      const calls = [0, 1, 2].map((i) =>
        loadSection(async () => (order.includes(i) ? Promise.reject(dead) : `ok-${i}`)),
      );
      await expect(Promise.all(calls)).rejects.toBe(dead);
    }
  });

  it("không có 401 thì lỗi một khối KHÔNG làm sập các khối khác", async () => {
    const [a, b, c] = await Promise.all([
      loadSection(async () => "A"),
      loadSection(async () => Promise.reject(new ApiError("backend lỗi", 500))),
      loadSection(async () => "C"),
    ]);
    expect(a).toEqual({ ok: true, data: "A" });
    expect(b).toEqual({ ok: false, message: "backend lỗi" });
    expect(c).toEqual({ ok: true, data: "C" });
  });
});
