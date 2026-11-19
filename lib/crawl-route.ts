// lib/crawl-route.ts
// Khuôn dùng chung của các Route Handler ĐỌC cho /crawl (app/api/crawl/**, app/api/maintenance/**) — Nhóm 6,
// phần 3/3. Đây là các route để Client Component polling bằng useSWR.
//
// Quyền: chỉ cần ĐÃ ĐĂNG NHẬP ở route; việc "chỉ staff" do BACKEND quyết định (mọi GET này là
// require_role("ss_team") ở backend -> học viên nhận 403 thật). Cố ý KHÔNG gọi /auth/me ở mỗi lượt poll: thêm
// một round-trip mỗi vài giây chỉ để lặp lại điều backend đã kiểm. Trang /crawl (Server Component) vẫn
// requireStaff() nên học viên không bao giờ thấy được UI polling.
// GET chỉ đọc -> không cần verifyOrigin (chỉ bắt buộc cho mutation dựa cookie). Luôn no-store. Hết phiên ->
// 401 JSON thật (proxy.ts loại /api/*, không redirect) để client dừng polling hẳn.

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/client";
import { getSessionToken } from "@/lib/session";

export const NO_STORE = { "Cache-Control": "no-store" } as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CrawlRouteError {
  ok: false;
  message: string;
  /** error_code backend (vd phân biệt "bị đăng nhập nơi khác" với 401 thường, Phụ lục C). */
  errorCode?: string;
}

export function crawlFail(status: number, message: string, errorCode?: string): NextResponse {
  const body: CrawlRouteError = { ok: false, message, ...(errorCode ? { errorCode } : {}) };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function isUuid(raw: string): boolean {
  return UUID_RE.test(raw);
}

/** Số nguyên không âm tối đa 12 chữ số; thiếu -> `fallback`; rác -> null (route trả 400). */
export function parseNonNegInt(raw: string | null, fallback: number): number | null {
  if (raw === null || raw === "") return fallback;
  return /^\d{1,12}$/.test(raw) ? Number(raw) : null;
}

/** Số dòng log mỗi lượt: 1..2000 (trần của backend). */
export function parseLogLimit(raw: string | null): number | undefined | null {
  if (raw === null || raw === "") return undefined;
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 2000 ? n : null;
}

function statusOf(err: unknown): number {
  return err instanceof ApiError && err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
}

/**
 * Chạy `read` sau khi kiểm có phiên. Lỗi backend giữ nguyên mã 4xx/5xx thật (401 để client dừng polling,
 * 403 học viên, 429 rate limit, 404 run không tồn tại); không phải ApiError (mạng) -> 502.
 */
export async function crawlReadRoute(read: () => Promise<unknown>): Promise<NextResponse> {
  if (!(await getSessionToken())) return crawlFail(401, "Phiên đăng nhập đã hết hạn.");
  try {
    return NextResponse.json(await read(), { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ApiError) {
      return crawlFail(statusOf(err), err.message || "Máy chủ dữ liệu trả lỗi.", err.errorCode);
    }
    return crawlFail(502, "Không kết nối được máy chủ dữ liệu.");
  }
}
