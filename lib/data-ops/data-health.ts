// lib/data-ops/data-health.ts
// Phần THUẦN của tab "Tình trạng dữ liệu" (/crawl?tab=status, Nhóm 6 phần 3e): câu ghi chú cố định khi đóng job,
// phân trang hai bảng, chọn job "nên giữ", thông báo lỗi. Không gọi mạng, không server-only nên test được trực tiếp.
//
// HAI bảng có nút "Đóng job này" (nhóm job nghi trùng, job đã hết hạn nhưng vẫn Đang tuyển), mỗi bảng phân trang
// riêng với TÊN query param tách biệt (dup_page, exp_page), cùng lý do như tab Lịch sử (xem crawl-history.ts): dùng
// chung một tên thì bấm trang 2 ở bảng này sẽ kéo bảng kia theo.

import { parsePageParam } from "@/lib/data-ops/crawl-history";
import { UPSTREAM_TIMEOUT_MESSAGE, isUpstreamTimeout } from "@/lib/upstream-timeout";

// ---------------------------------------------------------------------------
// Ghi chú đóng job (activity_note / `note` của PATCH /jobs/{id}, ghi vào lịch sử thao tác)
// ---------------------------------------------------------------------------

/**
 * Chuỗi CỐ ĐỊNH, do SERVER điền (client chỉ gửi loại bảng và id job, không gửi được note tuỳ ý qua đường này).
 * `duplicate` giữ đúng câu của bản Flask; `expired` là câu riêng cho bảng mới (Flask chưa có nút này) vì lý do đóng khác.
 */
export const CLOSE_JOB_NOTES = {
  duplicate: "Đóng do nghi trùng lặp (tab Vận hành dữ liệu — Tình trạng dữ liệu)",
  expired: "Đóng do đã quá hạn nhưng vẫn Đang tuyển (tab Vận hành dữ liệu — Tình trạng dữ liệu)",
} as const;

export type CloseJobKind = keyof typeof CLOSE_JOB_NOTES;

export function isCloseJobKind(value: unknown): value is CloseJobKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CLOSE_JOB_NOTES, value);
}

// ---------------------------------------------------------------------------
// Phân trang
// ---------------------------------------------------------------------------

/** Mỗi nhóm trùng gồm nhiều dòng job nên trang ngắn hơn bảng hết hạn. */
export const DUP_PAGE_SIZE = 10;
export const EXPIRED_PAGE_SIZE = 20;

export interface StatusQuery {
  dupPage: number;
  expPage: number;
}

type RawParams = Record<string, string | string[] | undefined>;

/** Trang rác/âm/0/thập phân -> 1, không lỗi (cùng quy tắc tab Lịch sử). */
export function parseStatusQuery(params: RawParams): StatusQuery {
  return { dupPage: parsePageParam(params.dup_page), expPage: parsePageParam(params.exp_page) };
}

/** Link tab Tình trạng dữ liệu: trang 1 bị lược để URL gọn. */
export function statusHref(q: StatusQuery): string {
  const p = new URLSearchParams();
  p.set("tab", "status");
  if (q.dupPage > 1) p.set("dup_page", String(q.dupPage));
  if (q.expPage > 1) p.set("exp_page", String(q.expPage));
  return `/crawl?${p.toString()}`;
}

/** Sang trang `page` của bảng nhóm trùng, giữ nguyên trang bảng hết hạn. */
export function dupPageHref(q: StatusQuery, page: number): string {
  return statusHref({ ...q, dupPage: page });
}

/** Sang trang `page` của bảng hết hạn, giữ nguyên trang bảng nhóm trùng. */
export function expPageHref(q: StatusQuery, page: number): string {
  return statusHref({ ...q, expPage: page });
}

export interface PageSlice<T> {
  items: T[];
  /** Trang thực sự hiển thị (đã kẹp vào [1, totalPages]). */
  page: number;
  totalPages: number;
  total: number;
}

/**
 * Cắt một trang từ danh sách đã tải đủ (backend trả toàn bộ nhóm/job, không phân trang). Trang vượt số trang thực
 * có thì kẹp về trang cuối: sau khi đóng job cuối cùng của một trang, danh sách ngắn đi và trang đang xem biến mất.
 */
export function slicePage<T>(all: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const shown = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = (shown - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), page: shown, totalPages, total };
}

/** Trang xin vượt quá số trang thực có -> trang cuối cần chuyển tới; còn trong phạm vi -> null. */
export function overflowPage(page: number, total: number, pageSize: number): number | null {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return page > last ? last : null;
}

// ---------------------------------------------------------------------------
// Nhóm job nghi trùng
// ---------------------------------------------------------------------------

/**
 * Id job NÊN GIỮ của một nhóm, lấy từ `suggest_keep` do BACKEND tính (frontend không tự so deadline lại). Phòng thủ:
 * id không thuộc nhóm (dữ liệu lệch giữa hai lần tải) thì coi như không có gợi ý, không đánh dấu nhầm job khác.
 */
export function keepJobId(group: { jobs: ReadonlyArray<{ id: string }>; suggest_keep?: string | null }): string | null {
  const id = group.suggest_keep;
  if (!id) return null;
  return group.jobs.some((j) => j.id === id) ? id : null;
}

/** "2026-11-30" -> "30/11/2026"; thiếu/sai định dạng -> "Không rõ". Cắt chuỗi, không qua Date nên không lệch múi giờ. */
export function deadlineLabel(deadline: string | null | undefined): string {
  const m = typeof deadline === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(deadline) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "Không rõ";
}

// ---------------------------------------------------------------------------
// Số liệu thiếu field
// ---------------------------------------------------------------------------

/** "12/40 (30%)". Tổng 0 thì chỉ hiện "0/0", không chia cho 0. */
export function missingSummary(row: { missing: number; total: number; pct_missing: number }): string {
  return row.total > 0 ? `${row.missing}/${row.total} (${row.pct_missing}%)` : `${row.missing}/${row.total}`;
}

// ---------------------------------------------------------------------------
// Thông báo lỗi khi đóng job
// ---------------------------------------------------------------------------

/** Lỗi đóng job theo status backend. 404 và 503 có câu riêng vì cách xử lý khác nhau (tải lại / đợi rồi thử lại). */
export function closeJobErrorMessage(status: number | undefined, fallback?: string): string {
  if (status === 404) return "Job này không còn tồn tại (có thể đã bị xoá). Danh sách đã được tải lại.";
  if (status === 503) return fallback || "Có thao tác khác đang ghi job cùng công ty. Đợi vài giây rồi thử lại.";
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền đóng job.";
  if (isUpstreamTimeout(status)) return UPSTREAM_TIMEOUT_MESSAGE;
  if (status !== undefined && status >= 500) return "Máy chủ dữ liệu đang gặp sự cố. Vui lòng thử lại sau.";
  return "Không đóng được job. Vui lòng thử lại.";
}
