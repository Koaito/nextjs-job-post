// lib/data-ops/crawl-tabs.ts
// 4 tab của /crawl (Nhóm 6, phần 3/3). Thuần, không import server-only.
//
// Đổi tab là ĐIỀU HƯỚNG THẬT (?tab=): server chỉ dựng nội dung của ĐÚNG tab đang mở, nên tab ẩn không
// tồn tại trong cây React và vòng polling của nó không thể chạy ngầm (bản Flask từng dựng cả 4 tab
// cùng lúc rồi để 2 vòng polling chạy nền). Mỗi tab tự mang bộ query riêng, nên đổi tab bỏ query của
// tab cũ (không mang `crawl_page` sang tab khác).

export const CRAWL_TAB_IDS = ["crawl", "status", "maintenance", "history"] as const;
export type CrawlTabId = (typeof CRAWL_TAB_IDS)[number];

export const DEFAULT_CRAWL_TAB: CrawlTabId = "crawl";

export const CRAWL_TAB_LABELS: Record<CrawlTabId, string> = {
  crawl: "Crawl",
  status: "Tình trạng dữ liệu",
  maintenance: "Bảo trì",
  history: "Lịch sử",
};

export function isCrawlTabId(value: unknown): value is CrawlTabId {
  return typeof value === "string" && (CRAWL_TAB_IDS as readonly string[]).includes(value);
}

/** ?tab= thiếu/lạ/lặp -> tab mặc định (giống Flask, không 404). */
export function parseCrawlTab(raw: string | string[] | undefined): CrawlTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isCrawlTabId(value) ? value : DEFAULT_CRAWL_TAB;
}

/** Tab mặc định có URL gọn (/crawl), các tab khác /crawl?tab=... */
export function crawlTabHref(tab: CrawlTabId): string {
  return tab === DEFAULT_CRAWL_TAB ? "/crawl" : `/crawl?tab=${tab}`;
}

/**
 * Widget "Đang chạy" hiện CHÉO (plan 4.3): tab Crawl hiện job Bảo trì đang chạy, tab Bảo trì hiện
 * job Crawl, tab Tình trạng dữ liệu hiện cả hai. Tab Lịch sử không có widget (và không polling).
 * `null` = tab không hiện widget.
 */
export type ActiveRunsScope = "crawl" | "maintenance" | "both";

export function activeRunsScopeForTab(tab: CrawlTabId): ActiveRunsScope | null {
  switch (tab) {
    case "crawl":
      return "maintenance";
    case "maintenance":
      return "crawl";
    case "status":
      return "both";
    case "history":
      return null;
  }
}
