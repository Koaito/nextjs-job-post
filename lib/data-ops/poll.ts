// lib/data-ops/poll.ts
// Tính toán thuần cho các vòng polling của /crawl (xem app/(app)/crawl/use-polled-json.ts).

/**
 * Độ trễ trước lần thử lại thứ `retryCount` (bắt đầu từ 1) khi polling lỗi: gấp đôi mỗi lần từ `baseMs`,
 * trần `maxMs`. Khớp quy tắc createPoller() của bản Flask (badge: 20s -> 40s -> 45s...). Thành công một
 * lần là SWR tự quay về `refreshInterval` gốc.
 */
export function pollBackoffDelay(baseMs: number, retryCount: number, maxMs: number): number {
  const n = Math.max(0, Math.trunc(retryCount));
  return Math.min(baseMs * 2 ** n, maxMs);
}

/** Lỗi HTTP có mã trạng thái (và error_code backend nếu có) từ Route Handler polling của mình. */
export class PollHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode?: string,
  ) {
    super(`poll request failed: ${status}`);
    this.name = "PollHttpError";
  }
}

/** Lỗi KHÔNG đáng thử lại: hết phiên (401) hoặc không có quyền (403) — thử lại chỉ tốn request. */
export function isTerminalPollError(err: unknown): boolean {
  return err instanceof PollHttpError && (err.status === 401 || err.status === 403);
}
