import { describe, expect, it } from "vitest";
import {
  buildHistoryParams,
  clampedPage,
  crawlPageHref,
  HISTORY_MAX_PAGE,
  historyHref,
  maintPageHref,
  offsetOf,
  parseHistoryQuery,
  parsePageParam,
  totalPagesOf,
} from "@/lib/data-ops/crawl-history";

describe("parsePageParam", () => {
  it("số nguyên dương hợp lệ", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("7")).toBe(7);
    expect(parsePageParam(" 3 ")).toBe(3);
  });
  it("rác / 0 / âm / thập phân / quá trần / thiếu -> 1", () => {
    for (const bad of ["0", "-2", "1.5", "abc", "", "1e3", "9999999", String(HISTORY_MAX_PAGE + 1)]) {
      expect(parsePageParam(bad)).toBe(1);
    }
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(String(HISTORY_MAX_PAGE))).toBe(HISTORY_MAX_PAGE);
  });
  it("lặp tham số lấy giá trị đầu", () => {
    expect(parsePageParam(["4", "9"])).toBe(4);
  });
});

describe("parseHistoryQuery", () => {
  it("mặc định: trang 1, không lọc", () => {
    expect(parseHistoryQuery({})).toEqual({
      crawlPage: 1,
      crawlSource: "",
      crawlStatus: "",
      maintPage: 1,
      maintJobType: "",
      maintStatus: "",
    });
  });
  it("đọc đúng TÊN param riêng của từng bảng", () => {
    const q = parseHistoryQuery({
      crawl_page: "2",
      c_source: "topcv",
      c_status: "error",
      maint_page: "5",
      m_job_type: "check_expired_jobs",
      m_status: "done",
    });
    expect(q).toEqual({
      crawlPage: 2,
      crawlSource: "topcv",
      crawlStatus: "error",
      maintPage: 5,
      maintJobType: "check_expired_jobs",
      maintStatus: "done",
    });
  });
  it("hai bảng không đọc nhầm param của nhau (`page` chung không có tác dụng)", () => {
    const q = parseHistoryQuery({ page: "4", status: "error", job_type: "check_expired_jobs", source: "topcv" });
    expect(q.crawlPage).toBe(1);
    expect(q.maintPage).toBe(1);
    expect(q.crawlStatus).toBe("");
    expect(q.maintJobType).toBe("");
    expect(q.crawlSource).toBe("");
  });
  it("giá trị lọc không hợp lệ bị bỏ (không lỗi)", () => {
    const q = parseHistoryQuery({
      c_source: "../etc/passwd",
      c_status: "exploded",
      m_job_type: "drop_tables",
      m_status: "finished",
    });
    expect(q.crawlSource).toBe("");
    expect(q.crawlStatus).toBe("");
    expect(q.maintJobType).toBe("");
    expect(q.maintStatus).toBe("");
  });
  it("tên nguồn được chuẩn hoá chữ thường", () => {
    expect(parseHistoryQuery({ c_source: "TopCV" }).crawlSource).toBe("topcv");
  });
});

describe("buildHistoryParams / href", () => {
  const base = parseHistoryQuery({});

  it("URL gọn: trang 1 và lọc rỗng bị lược, luôn có tab=history", () => {
    expect(historyHref(base)).toBe("/crawl?tab=history");
  });

  it("đổi trang bảng crawl giữ NGUYÊN trang và lọc của bảng bảo trì (và ngược lại)", () => {
    const q = parseHistoryQuery({ maint_page: "3", m_status: "error", c_source: "topcv" });
    const toCrawl2 = new URL(crawlPageHref(q, 2), "http://x").searchParams;
    expect(toCrawl2.get("crawl_page")).toBe("2");
    expect(toCrawl2.get("maint_page")).toBe("3");
    expect(toCrawl2.get("m_status")).toBe("error");
    expect(toCrawl2.get("c_source")).toBe("topcv");

    const q2 = parseHistoryQuery({ crawl_page: "4", c_status: "done" });
    const toMaint2 = new URL(maintPageHref(q2, 2), "http://x").searchParams;
    expect(toMaint2.get("maint_page")).toBe("2");
    expect(toMaint2.get("crawl_page")).toBe("4");
    expect(toMaint2.get("c_status")).toBe("done");
  });

  it("về trang 1 thì bỏ param trang của bảng đó", () => {
    const q = parseHistoryQuery({ crawl_page: "3", maint_page: "2" });
    const p = new URL(crawlPageHref(q, 1), "http://x").searchParams;
    expect(p.has("crawl_page")).toBe(false);
    expect(p.get("maint_page")).toBe("2");
  });

  it("round-trip: build rồi parse ra đúng query cũ", () => {
    const q = parseHistoryQuery({
      crawl_page: "2",
      c_source: "vietnamworks",
      c_status: "running",
      maint_page: "3",
      m_job_type: "enrich_web_info",
      m_status: "queued",
    });
    const params = Object.fromEntries(buildHistoryParams(q).entries());
    expect(parseHistoryQuery(params)).toEqual(q);
  });
});

describe("phân trang", () => {
  it("totalPagesOf: tối thiểu 1, làm tròn lên", () => {
    expect(totalPagesOf(0)).toBe(1);
    expect(totalPagesOf(20)).toBe(1);
    expect(totalPagesOf(21)).toBe(2);
    expect(totalPagesOf(45)).toBe(3);
  });
  it("offsetOf theo trang 1-based", () => {
    expect(offsetOf(1)).toBe(0);
    expect(offsetOf(3)).toBe(40);
  });
  it("clampedPage: trong phạm vi -> null; vượt -> trang cuối; tổng 0 -> trang 1 luôn hợp lệ", () => {
    expect(clampedPage(1, 0)).toBeNull();
    expect(clampedPage(2, 0)).toBe(1);
    expect(clampedPage(3, 45)).toBeNull();
    expect(clampedPage(4, 45)).toBe(3);
    expect(clampedPage(9, 20)).toBe(1);
  });
});
