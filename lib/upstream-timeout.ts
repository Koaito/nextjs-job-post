// lib/upstream-timeout.ts
// Mã và câu báo lỗi khi backend (Render free tier) phản hồi quá lâu. Module THUẦN (không import server-only) nên cả
// lib/api/client.ts (phía server) lẫn các hàm báo lỗi của lib/data-ops/* (client component cũng import) dùng chung được
// một nguồn duy nhất, không sinh bản sao thứ hai của câu chữ.

export const UPSTREAM_TIMEOUT_CODE = "upstream_timeout";
export const UPSTREAM_TIMEOUT_MESSAGE =
  "Máy chủ phản hồi quá lâu (có thể đang khởi động lại). Vui lòng thử lại sau ít giây.";

/**
 * Lỗi "chờ backend quá lâu": hoặc hạn chờ của app (ApiError 504 mã `upstream_timeout`, xem fetchWithTimeout ở
 * lib/api/client.ts), hoặc 504 thật do cổng của hạ tầng trả về khi backend đang ngủ. Cả hai cùng một cách xử lý: thử lại.
 */
export function isUpstreamTimeout(status: number | undefined, errorCode?: string): boolean {
  return status === 504 || errorCode === UPSTREAM_TIMEOUT_CODE;
}
