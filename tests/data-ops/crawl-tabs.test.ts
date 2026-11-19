import { describe, expect, it } from "vitest";
import {
  activeRunsScopeForTab,
  CRAWL_TAB_IDS,
  crawlTabHref,
  isCrawlTabId,
  parseCrawlTab,
} from "@/lib/data-ops/crawl-tabs";

describe("parseCrawlTab", () => {
  it("giá trị hợp lệ giữ nguyên", () => {
    for (const id of CRAWL_TAB_IDS) expect(parseCrawlTab(id)).toBe(id);
  });
  it("thiếu / lạ / rỗng / sai hoa thường -> tab Crawl (không 404)", () => {
    expect(parseCrawlTab(undefined)).toBe("crawl");
    expect(parseCrawlTab("")).toBe("crawl");
    expect(parseCrawlTab("nope")).toBe("crawl");
    expect(parseCrawlTab("History")).toBe("crawl");
  });
  it("lặp ?tab=a&tab=b lấy giá trị đầu", () => {
    expect(parseCrawlTab(["history", "status"])).toBe("history");
    expect(parseCrawlTab(["zzz", "history"])).toBe("crawl");
  });
  it("isCrawlTabId không nhận prototype key", () => {
    expect(isCrawlTabId("constructor")).toBe(false);
    expect(isCrawlTabId(undefined)).toBe(false);
  });
});

describe("crawlTabHref", () => {
  it("tab mặc định có URL gọn, tab khác có ?tab=", () => {
    expect(crawlTabHref("crawl")).toBe("/crawl");
    expect(crawlTabHref("history")).toBe("/crawl?tab=history");
    expect(crawlTabHref("maintenance")).toBe("/crawl?tab=maintenance");
  });
});

describe("activeRunsScopeForTab (widget Đang chạy hiện CHÉO)", () => {
  it("tab Crawl hiện bảo trì, tab Bảo trì hiện crawl, tab Tình trạng hiện cả hai, Lịch sử không có widget", () => {
    expect(activeRunsScopeForTab("crawl")).toBe("maintenance");
    expect(activeRunsScopeForTab("maintenance")).toBe("crawl");
    expect(activeRunsScopeForTab("status")).toBe("both");
    expect(activeRunsScopeForTab("history")).toBeNull();
  });
});
