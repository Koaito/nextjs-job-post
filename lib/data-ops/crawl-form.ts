// lib/data-ops/crawl-form.ts
// Form kích hoạt crawl (tab Crawl của /crawl, Nhóm 6 phần 3c): kiểm tra đầu vào + thông báo lỗi tiếng Việt.
// Thuần (không gọi mạng, không server-only): Client Component dùng để báo lỗi ngay trên form, Route Handler
// dùng lại ĐÚNG hàm kiểm body (không tin client), nên hai nơi không thể lệch nhau.

import {
  CRAWL_MAX_JOBS_MAX,
  CRAWL_MAX_JOBS_MIN,
  CRAWL_PAGES_MAX,
  CRAWL_PAGES_MIN,
  type CrawlBatchRequest,
} from "@/lib/data-ops/crawl";
import { UPSTREAM_TIMEOUT_MESSAGE, isUpstreamTimeout } from "@/lib/upstream-timeout";

/** Tối đa category mỗi batch (khớp CrawlBatchRequest.categories max_length=20). */
export const CRAWL_BATCH_MAX_CATEGORIES = 20;
/** Tên nguồn/category backend dùng: chữ thường, số, gạch ngang/dưới. */
const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/;

export interface CrawlFormErrors {
  source?: string;
  categories?: string;
  pages?: string;
  maxJobs?: string;
}

export type CrawlFormResult =
  | { ok: true; request: CrawlBatchRequest }
  | { ok: false; errors: CrawlFormErrors };

type IntResult = { ok: true; value: number | undefined } | { ok: false };

/** Ô số tuỳ chọn: rỗng -> undefined (backend tự áp mặc định); phải là số nguyên trong [min, max]. */
export function parseOptionalInt(text: string, min: number, max: number): IntResult {
  const t = text.trim();
  if (t === "") return { ok: true, value: undefined };
  if (!/^\d{1,6}$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= min && n <= max ? { ok: true, value: n } : { ok: false };
}

export interface CrawlFormInput {
  source: string;
  categories: string[];
  pagesText: string;
  maxJobsText: string;
}

/** Kiểm form phía trình duyệt; trả TẤT CẢ lỗi một lượt để hiện cạnh từng ô. */
export function validateCrawlForm(input: CrawlFormInput): CrawlFormResult {
  const errors: CrawlFormErrors = {};
  if (!input.source) errors.source = "Chọn nguồn cần crawl.";
  if (input.categories.length === 0) errors.categories = "Chọn ít nhất một category.";
  else if (input.categories.length > CRAWL_BATCH_MAX_CATEGORIES) {
    errors.categories = `Một lần chạy tối đa ${CRAWL_BATCH_MAX_CATEGORIES} category.`;
  }
  const pages = parseOptionalInt(input.pagesText, CRAWL_PAGES_MIN, CRAWL_PAGES_MAX);
  if (!pages.ok) errors.pages = `Số trang phải là số nguyên từ ${CRAWL_PAGES_MIN} đến ${CRAWL_PAGES_MAX}.`;
  const maxJobs = parseOptionalInt(input.maxJobsText, CRAWL_MAX_JOBS_MIN, CRAWL_MAX_JOBS_MAX);
  if (!maxJobs.ok) {
    errors.maxJobs = `Số tin tối đa phải là số nguyên từ ${CRAWL_MAX_JOBS_MIN} đến ${CRAWL_MAX_JOBS_MAX}.`;
  }
  if (Object.keys(errors).length > 0 || !pages.ok || !maxJobs.ok) return { ok: false, errors };

  const request: CrawlBatchRequest = { source: input.source, categories: input.categories };
  if (pages.value !== undefined) request.pages = pages.value;
  if (maxJobs.value !== undefined) request.max_jobs = maxJobs.value;
  return { ok: true, request };
}

const ALLOWED_BODY_KEYS = new Set(["source", "categories", "pages", "max_jobs"]);

function intField(value: unknown, min: number, max: number): number | undefined | "bad" {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : "bad";
}

/**
 * Kiểm BODY JSON của POST /api/crawl/batch phía server (không tin client). Chặt hơn form: chỉ nhận đúng 4 khoá
 * (backend extra="forbid"), category phải là chuỗi khoá hợp lệ, không rỗng, không trùng.
 * Trả request đã chuẩn hoá hoặc `{ message }` để route trả 400.
 */
export function validateCrawlBody(body: unknown): { request: CrawlBatchRequest } | { message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "Dữ liệu gửi lên không hợp lệ." };
  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_BODY_KEYS.has(key)) return { message: "Dữ liệu gửi lên có trường không hợp lệ." };
  }
  if (typeof raw.source !== "string" || !KEY_RE.test(raw.source)) return { message: "Nguồn crawl không hợp lệ." };
  const categories = raw.categories;
  if (!Array.isArray(categories) || categories.length === 0) return { message: "Chọn ít nhất một category." };
  if (categories.length > CRAWL_BATCH_MAX_CATEGORIES) {
    return { message: `Một lần chạy tối đa ${CRAWL_BATCH_MAX_CATEGORIES} category.` };
  }
  const seen = new Set<string>();
  for (const c of categories) {
    if (typeof c !== "string" || !KEY_RE.test(c)) return { message: "Category không hợp lệ." };
    if (seen.has(c)) return { message: "Category bị chọn trùng." };
    seen.add(c);
  }
  const pages = intField(raw.pages, CRAWL_PAGES_MIN, CRAWL_PAGES_MAX);
  if (pages === "bad") return { message: `Số trang phải từ ${CRAWL_PAGES_MIN} đến ${CRAWL_PAGES_MAX}.` };
  const maxJobs = intField(raw.max_jobs, CRAWL_MAX_JOBS_MIN, CRAWL_MAX_JOBS_MAX);
  if (maxJobs === "bad") return { message: `Số tin tối đa phải từ ${CRAWL_MAX_JOBS_MIN} đến ${CRAWL_MAX_JOBS_MAX}.` };

  const request: CrawlBatchRequest = { source: raw.source, categories: [...categories] as string[] };
  if (pages !== undefined) request.pages = pages;
  if (maxJobs !== undefined) request.max_jobs = maxJobs;
  return { request };
}

/**
 * Thông báo cho lỗi kích hoạt, rẽ nhánh theo status/error_code (không đọc nội dung message backend).
 * 429 backend KHÔNG có error_code (chỉ có status), nên phải rẽ theo status.
 */
export function crawlTriggerErrorMessage(status: number, errorCode?: string, fallback?: string): string {
  if (status === 409 || errorCode === "crawl_already_active") {
    return "Nguồn này đang có lượt crawl chạy dở. Đợi lượt đó xong rồi chạy lại.";
  }
  if (status === 429) return "Đã chạy quá 10 lượt crawl trong 1 giờ. Thử lại sau.";
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Chỉ admin mới được chạy crawl.";
  if (status === 413) return "Dữ liệu gửi lên quá lớn.";
  if (status === 0) return "Không kết nối được máy chủ. Vui lòng thử lại.";
  if (isUpstreamTimeout(status, errorCode)) return UPSTREAM_TIMEOUT_MESSAGE;
  if (status >= 500) return "Máy chủ dữ liệu đang gặp sự cố. Vui lòng thử lại sau.";
  return fallback || "Không chạy được crawl. Vui lòng kiểm tra lại lựa chọn.";
}
