// lib/data-ops/crawl-history.ts
// Query string của tab Lịch sử (/crawl?tab=history). Thuần, có test.
//
// HAI bảng độc lập trên cùng một trang (crawl + bảo trì), mỗi bảng phân trang và lọc riêng. Vì vậy
// mỗi bảng có TÊN query param riêng, hoàn toàn tách biệt (plan 4.3): nếu dùng chung `page`, bấm sang
// trang 2 của bảng này sẽ kéo bảng kia theo.
//
//   bảng crawl:   crawl_page, c_source, c_status
//   bảng bảo trì: maint_page, m_job_type, m_status
//
// Đổi bộ lọc của một bảng chỉ reset trang của bảng đó; bảng kia giữ nguyên cả lọc lẫn trang.

import { isMaintenanceJobType, type MaintenanceJobType } from "@/lib/data-ops/maintenance";

export const HISTORY_PAGE_SIZE = 20;
/** Trần số trang đọc từ URL (chặn offset khổng lồ do URL tự gõ). */
export const HISTORY_MAX_PAGE = 5000;

export const RUN_STATUS_FILTERS = ["queued", "running", "done", "error"] as const;
export type RunStatusFilter = (typeof RUN_STATUS_FILTERS)[number];

export function isRunStatusFilter(value: unknown): value is RunStatusFilter {
  return typeof value === "string" && (RUN_STATUS_FILTERS as readonly string[]).includes(value);
}

/** Tên nguồn crawl backend dùng: chữ thường, số, gạch ngang/gạch dưới; không khớp thì bỏ lọc. */
const SOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,49}$/;

export interface HistoryQuery {
  crawlPage: number;
  crawlSource: string;
  crawlStatus: RunStatusFilter | "";
  maintPage: number;
  maintJobType: MaintenanceJobType | "";
  maintStatus: RunStatusFilter | "";
}

type RawParams = Record<string, string | string[] | undefined>;

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

/** Trang >= 1, số nguyên dương; rác/âm/0/thập phân/quá lớn -> 1 (không lỗi). */
export function parsePageParam(raw: string | string[] | undefined): number {
  const text = first(raw);
  if (!/^\d{1,6}$/.test(text)) return 1;
  const n = Number(text);
  return n >= 1 && n <= HISTORY_MAX_PAGE ? n : 1;
}

/** Giá trị lọc không hợp lệ bị BỎ (thành "" = không lọc), không báo lỗi — giống Flask. */
export function parseHistoryQuery(params: RawParams): HistoryQuery {
  const source = first(params.c_source).toLowerCase();
  const cStatus = first(params.c_status);
  const jobType = first(params.m_job_type);
  const mStatus = first(params.m_status);
  return {
    crawlPage: parsePageParam(params.crawl_page),
    crawlSource: SOURCE_RE.test(source) ? source : "",
    crawlStatus: isRunStatusFilter(cStatus) ? cStatus : "",
    maintPage: parsePageParam(params.maint_page),
    maintJobType: isMaintenanceJobType(jobType) ? jobType : "",
    maintStatus: isRunStatusFilter(mStatus) ? mStatus : "",
  };
}

/** Query của cả hai bảng, trang 1 và giá trị rỗng bị lược (URL gọn). */
export function buildHistoryParams(q: HistoryQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set("tab", "history");
  if (q.crawlSource) p.set("c_source", q.crawlSource);
  if (q.crawlStatus) p.set("c_status", q.crawlStatus);
  if (q.crawlPage > 1) p.set("crawl_page", String(q.crawlPage));
  if (q.maintJobType) p.set("m_job_type", q.maintJobType);
  if (q.maintStatus) p.set("m_status", q.maintStatus);
  if (q.maintPage > 1) p.set("maint_page", String(q.maintPage));
  return p;
}

export function historyHref(q: HistoryQuery): string {
  return `/crawl?${buildHistoryParams(q).toString()}`;
}

/** Link sang trang `page` của bảng crawl, giữ nguyên MỌI thứ còn lại (kể cả trang bảng bảo trì). */
export function crawlPageHref(q: HistoryQuery, page: number): string {
  return historyHref({ ...q, crawlPage: page });
}

/** Link sang trang `page` của bảng bảo trì, giữ nguyên mọi thứ còn lại. */
export function maintPageHref(q: HistoryQuery, page: number): string {
  return historyHref({ ...q, maintPage: page });
}

export function totalPagesOf(total: number, pageSize: number = HISTORY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function offsetOf(page: number, pageSize: number = HISTORY_PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

/**
 * Trang đang xin vượt quá số trang thực có (vd lọc thu hẹp kết quả, hoặc bookmark cũ) -> trang cuối
 * hợp lệ cần chuyển tới; còn trong phạm vi -> null. Tổng = 0 thì trang 1 luôn hợp lệ.
 */
export function clampedPage(page: number, total: number, pageSize: number = HISTORY_PAGE_SIZE): number | null {
  const last = totalPagesOf(total, pageSize);
  return page > last ? last : null;
}
