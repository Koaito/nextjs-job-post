import { describe, expect, it } from "vitest";
import {
  crawlTriggerErrorMessage,
  parseOptionalInt,
  validateCrawlBody,
  validateCrawlForm,
} from "@/lib/data-ops/crawl-form";

describe("parseOptionalInt", () => {
  it("rỗng -> không đặt (backend tự áp mặc định)", () => {
    expect(parseOptionalInt("", 1, 20)).toEqual({ ok: true, value: undefined });
    expect(parseOptionalInt("   ", 1, 20)).toEqual({ ok: true, value: undefined });
  });
  it("biên 1 và 20 hợp lệ, 0 và 21 không", () => {
    expect(parseOptionalInt("1", 1, 20)).toEqual({ ok: true, value: 1 });
    expect(parseOptionalInt("20", 1, 20)).toEqual({ ok: true, value: 20 });
    expect(parseOptionalInt("0", 1, 20)).toEqual({ ok: false });
    expect(parseOptionalInt("21", 1, 20)).toEqual({ ok: false });
  });
  it("chữ, âm, thập phân, số mũ -> sai", () => {
    for (const bad of ["abc", "-3", "2.5", "1e2", "٣", "5 trang"]) expect(parseOptionalInt(bad, 1, 20)).toEqual({ ok: false });
  });
});

describe("validateCrawlForm", () => {
  const base = { source: "topcv", categories: ["data-analyst"], pagesText: "", maxJobsText: "" };
  it("hợp lệ: chỉ gửi field có giá trị", () => {
    expect(validateCrawlForm(base)).toEqual({ ok: true, request: { source: "topcv", categories: ["data-analyst"] } });
    expect(validateCrawlForm({ ...base, pagesText: "3", maxJobsText: "50" })).toEqual({
      ok: true,
      request: { source: "topcv", categories: ["data-analyst"], pages: 3, max_jobs: 50 },
    });
  });
  it("báo TẤT CẢ lỗi một lượt", () => {
    const r = validateCrawlForm({ source: "", categories: [], pagesText: "0", maxJobsText: "5000" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["categories", "maxJobs", "pages", "source"]);
  });
  it("quá 20 category -> lỗi", () => {
    const many = Array.from({ length: 21 }, (_, i) => `c${i}`);
    expect(validateCrawlForm({ ...base, categories: many }).ok).toBe(false);
  });
});

describe("validateCrawlBody (server không tin client)", () => {
  const ok = { source: "topcv", categories: ["data-analyst", "data-engineer"], pages: 2, max_jobs: 100 };
  it("body hợp lệ giữ nguyên thứ tự category", () => {
    expect(validateCrawlBody(ok)).toEqual({ request: ok });
    expect(validateCrawlBody({ source: "topcv", categories: ["a"], pages: null })).toEqual({
      request: { source: "topcv", categories: ["a"] },
    });
  });
  it("không phải object / mảng / null -> lỗi", () => {
    for (const bad of [null, [], "x", 5, undefined]) expect("message" in validateCrawlBody(bad)).toBe(true);
  });
  it("trường lạ bị chặn (backend extra=forbid)", () => {
    expect("message" in validateCrawlBody({ ...ok, triggered_by: "me" })).toBe(true);
  });
  it("nguồn/category sai dạng, trống, trùng, quá nhiều", () => {
    expect("message" in validateCrawlBody({ ...ok, source: "../x" })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, source: 5 })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, categories: [] })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, categories: "a" })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, categories: ["a", "a"] })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, categories: ["A B"] })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, categories: Array.from({ length: 21 }, (_, i) => `c${i}`) })).toBe(true);
  });
  it("pages/max_jobs: biên và kiểu", () => {
    expect("message" in validateCrawlBody({ ...ok, pages: 0 })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, pages: 21 })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, pages: "3" })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, pages: 1.5 })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, max_jobs: 1001 })).toBe(true);
    expect("message" in validateCrawlBody({ ...ok, pages: 20, max_jobs: 1000 })).toBe(false);
  });
});

describe("crawlTriggerErrorMessage", () => {
  it("409 và error_code crawl_already_active -> nguồn đang chạy dở", () => {
    expect(crawlTriggerErrorMessage(409)).toMatch(/đang có lượt crawl chạy dở/);
    expect(crawlTriggerErrorMessage(400, "crawl_already_active")).toMatch(/chạy dở/);
  });
  it("429 không có error_code vẫn nhận ra qua status", () => {
    expect(crawlTriggerErrorMessage(429)).toMatch(/10 lượt/);
  });
  it("401, 403, 413, mạng, 5xx, và fallback cho 4xx khác", () => {
    expect(crawlTriggerErrorMessage(401)).toMatch(/hết hạn/);
    expect(crawlTriggerErrorMessage(403)).toMatch(/admin/);
    expect(crawlTriggerErrorMessage(413)).toMatch(/quá lớn/);
    expect(crawlTriggerErrorMessage(0)).toMatch(/kết nối/);
    expect(crawlTriggerErrorMessage(503)).toMatch(/sự cố/);
    expect(crawlTriggerErrorMessage(400, undefined, "Category không tồn tại")).toBe("Category không tồn tại");
    expect(crawlTriggerErrorMessage(400)).toMatch(/kiểm tra lại/);
  });
});
